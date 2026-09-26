import { neon } from '@neondatabase/serverless';

// শুধু সার্ভারে চলে — DATABASE_URL কখনো ব্রাউজারে যায় না
//
// দুই রকম ডেটাবেসে চলে:
//   • Neon (…neon.tech) — Neon-এর HTTP পথে, Vercel-এ যেমন চলছে
//   • অন্য যেকোনো Postgres (যেমন VPS-এ Docker-এর ভেতরে) — সাধারণ pg সংযোগে
// দুটোর চেহারা একই — sql`…`, sql.query(text, params), sql.transaction([...]) —
// তাই বাকি কোড জানেই না কোনটা চলছে। DB_DRIVER=neon বা pg দিয়ে জোর করেও বাছা যায়।
let cached = null;

function isNeon(url) {
  const forced = process.env.DB_DRIVER;
  if (forced === 'neon' || forced === 'pg') return forced === 'neon';
  try {
    return new URL(url).hostname.endsWith('.neon.tech');
  } catch (err) {
    return false;
  }
}

// সাধারণ Postgres, Neon-এর মতো করে সাজানো। pg প্যাকেজ কেবল এখানেই, আর
// প্রথম প্রশ্নের সময়ই নামে — Vercel-এ Neon চললে ওটা কখনো লোডই হয় না।
function pgSql(url) {
  let pool = null;
  const getPool = async () => {
    if (!pool) {
      const { default: pg } = await import('pg');
      pool = new pg.Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX) || 10 });
    }
    return pool;
  };
  const run = async (text, values) => (await (await getPool()).query(text, values)).rows;

  // neon-এর মতোই sql`…` সাথে সাথে চলে না: await করলে চলে, আর transaction-এ
  // দিলে সেখানে একসাথে চলে। একবারই চলে, যতবারই then ডাকা হোক।
  function sql(strings, ...values) {
    let text = strings[0];
    values.forEach((v, i) => {
      text += '$' + (i + 1) + strings[i + 1];
    });
    let started = null;
    const go = () => started || (started = run(text, values));
    return {
      text,
      values,
      then: (ok, bad) => go().then(ok, bad),
      catch: (bad) => go().catch(bad),
      finally: (fn) => go().finally(fn),
    };
  }

  sql.query = (text, params = []) => run(text, params);

  sql.transaction = async (queries) => {
    const client = await (await getPool()).connect();
    try {
      await client.query('begin');
      const out = [];
      for (const q of queries) {
        // eslint-disable-next-line no-await-in-loop
        out.push((await client.query(q.text, q.values)).rows);
      }
      await client.query('commit');
      return out;
    } catch (err) {
      await client.query('rollback').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  };

  return sql;
}

export function db() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  cached = isNeon(url) ? neon(url) : pgSql(url);
  return cached;
}

export function hasDb() {
  return Boolean(process.env.DATABASE_URL);
}

// প্রথম ডাকেই টেবিলগুলো বানিয়ে নিই, যাতে আলাদা করে migration চালাতে না হয়
let ready = null;

export function ensureSchema() {
  if (ready) return ready;
  const sql = db();
  ready = (async () => {
    // সবগুলো একসাথে একটাই অনুরোধে পাঠাই। আগে প্রতিটা আলাদা HTTP কল ছিল,
    // তাই ঠান্ডা অবস্থায় (cold start) প্রথম অনুরোধে ১৫ বার ডেটাবেসে যেতে হতো।
    await sql.transaction([
      sql`
        create table if not exists nh_users (
          id          bigserial primary key,
          username    text not null unique,
          pass_hash   text not null,
          created_at  timestamptz not null default now()
        )
      `,
      sql`
        create table if not exists nh_sessions (
          token_hash  text primary key,
          user_id     bigint not null references nh_users(id) on delete cascade,
          expires_at  timestamptz not null,
          created_at  timestamptz not null default now()
        )
      `,
      sql`create index if not exists nh_sessions_user_idx on nh_sessions(user_id)`,
      sql`
        create table if not exists nh_days (
          user_id     bigint not null references nh_users(id) on delete cascade,
          day         date not null,
          data        jsonb not null default '{}'::jsonb,
          updated_at  bigint not null,
          primary key (user_id, day)
        )
      `,
      sql`
        create table if not exists nh_profile (
          user_id     bigint primary key references nh_users(id) on delete cascade,
          people      jsonb not null default '{}'::jsonb,
          updated_at  bigint not null
        )
      `,
      sql`alter table nh_users add column if not exists display_name text`,
      sql`alter table nh_users add column if not exists partner_id bigint references nh_users(id) on delete set null`,
      sql`
        create table if not exists nh_pair_codes (
          code        text primary key,
          user_id     bigint not null references nh_users(id) on delete cascade,
          expires_at  timestamptz not null
        )
      `,
      sql`
        create table if not exists nh_quran (
          user_id  bigint not null references nh_users(id) on delete cascade,
          surah    int not null,
          ayah     int not null,
          juz      int not null default 1,
          read_at  timestamptz not null default now(),
          primary key (user_id, surah, ayah)
        )
      `,
      sql`alter table nh_quran add column if not exists juz int not null default 1`,
      sql`
        create table if not exists nh_questions (
          id        bigserial primary key,
          topic     text not null,
          question  text not null,
          options   jsonb not null,
          answer    int not null,
          source    text not null default 'auto'
        )
      `,
      sql`create unique index if not exists nh_questions_uniq on nh_questions(md5(question))`,
      // প্রশ্ন কতটা কঠিন: easy | medium | hard।
      // রোজকার কুইজে সহজ আর মাঝারিগুলোই আসে, হাদিসের বর্ণনাকারী-শূন্যস্থানের
      // মতো কঠিনগুলো শুধু চাইলে।
      sql`alter table nh_questions add column if not exists level text not null default 'easy'`,
      sql`create index if not exists nh_questions_level on nh_questions(level)`,
      // কে কঠিন প্রশ্নও চায়
      sql`alter table nh_users add column if not exists hard_quiz boolean not null default false`,
      // পুশ নোটিফিকেশনের ঠিকানা। একজনের একাধিক ডিভাইস থাকতে পারে,
      // তাই প্রতিটি ব্রাউজারের endpoint আলাদা সারি।
      sql`
        create table if not exists nh_push (
          endpoint    text primary key,
          user_id     bigint not null references nh_users(id) on delete cascade,
          p256dh      text not null,
          auth        text not null,
          created_at  timestamptz not null default now()
        )
      `,
      sql`create index if not exists nh_push_user on nh_push(user_id)`,
      // নামাজের সময় হিসাব করতে জায়গা লাগে। না দিলে ঢাকা ধরা হয়।
      sql`alter table nh_users add column if not exists lat double precision`,
      sql`alter table nh_users add column if not exists lng double precision`,
      sql`alter table nh_users add column if not exists city text`,
      sql`alter table nh_users add column if not exists notify_prayer boolean not null default false`,
      sql`alter table nh_users add column if not exists notify_quran boolean not null default false`,
      // একই জিনিস দুবার যেন না পাঠাই — cron ঘন ঘন চলে
      sql`
        create table if not exists nh_notified (
          user_id  bigint not null references nh_users(id) on delete cascade,
          day      date not null,
          slot     text not null,
          sent_at  timestamptz not null default now(),
          primary key (user_id, day, slot)
        )
      `,
      sql`
        create table if not exists nh_quiz (
          user_id  bigint not null references nh_users(id) on delete cascade,
          day      date not null,
          qids     jsonb not null,
          primary key (user_id, day)
        )
      `,
      sql`
        create table if not exists nh_quiz_answer (
          user_id  bigint not null references nh_users(id) on delete cascade,
          day      date not null,
          qid      bigint not null,
          chosen   int not null,
          correct  boolean not null,
          primary key (user_id, day, qid)
        )
      `,
      sql`
        create table if not exists nh_ticks (
          user_id  bigint not null references nh_users(id) on delete cascade,
          day      date not null,
          kind     text not null,
          item     text not null,
          primary key (user_id, day, kind, item)
        )
      `,
      // স্পর্শ — সঙ্গীর স্ক্রিনে আঁকা আর তার ফোন কাঁপানো। যার ফোন, সে-ই ঠিক
      // করে সঙ্গী এগুলো করতে পারবে কি না।
      sql`alter table nh_users add column if not exists touch_draw boolean not null default true`,
      sql`alter table nh_users add column if not exists touch_buzz boolean not null default true`,
      // একটা আঁকা বা একটা ডাক। seen_at — প্রাপক দেখেছে কি না; পুশ হারিয়ে
      // গেলেও অ্যাপ খুললে না-দেখা আঁকাটা দেখিয়ে দেওয়া যায়।
      sql`
        create table if not exists nh_touch (
          id          bigserial primary key,
          from_id     bigint not null references nh_users(id) on delete cascade,
          to_id       bigint not null references nh_users(id) on delete cascade,
          kind        text not null,
          aspect      real not null default 2,
          done        boolean not null default false,
          seen_at     timestamptz,
          created_at  timestamptz not null default now()
        )
      `,
      sql`create index if not exists nh_touch_to on nh_touch(to_id, id desc)`,
      // আঁকাটা টুকরো টুকরো করে আসে, আঁকার সাথে সাথে — seq ধরে সাজানো
      sql`
        create table if not exists nh_touch_part (
          touch_id  bigint not null references nh_touch(id) on delete cascade,
          seq       int not null,
          data      jsonb not null,
          primary key (touch_id, seq)
        )
      `,
      // কোন দিন থেকে "দিন পেরোলে না-লেখা ওয়াক্ত = পড়েনি" খাটে (lib/prayers.js)।
      // default-টা একবারই হিসাব হয়: যাঁরা আগে থেকে আছেন তাঁদের জন্য এই কলাম
      // যোগ হওয়ার দিন (ঢাকার তারিখে) — তাই পেছনের মাসের জরিমানা হঠাৎ বাড়ে না;
      // নতুন যিনি আসবেন, তাঁর জন্য তাঁর আসার দিন।
      sql`
        alter table nh_users add column if not exists missed_from date
          not null default ((now() at time zone 'Asia/Dhaka')::date)
      `,
      // মাসের জরিমানা মেটানো — জোড়ার দুজনের জন্য একটাই সারি (ছোট আইডি আগে)।
      // পরিশোধের মুহূর্তের হিসাবটা রেখে দিই, পরে কোনো দিনের হিসাব বদলালে যাতে
      // বোঝা যায় আবার মেলাতে হবে।
      sql`
        create table if not exists nh_settle (
          user_a    bigint not null references nh_users(id) on delete cascade,
          user_b    bigint not null references nh_users(id) on delete cascade,
          month     text not null,
          payer_id  bigint references nh_users(id) on delete cascade,
          amount    int not null,
          paid_by   bigint not null references nh_users(id) on delete cascade,
          paid_at   timestamptz not null default now(),
          primary key (user_a, user_b, month)
        )
      `,
    ]);
  })().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}
