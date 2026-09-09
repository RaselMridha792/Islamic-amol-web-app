import { neon } from '@neondatabase/serverless';

// শুধু সার্ভারে চলে — DATABASE_URL কখনো ব্রাউজারে যায় না
let cached = null;

export function db() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  cached = neon(url);
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
    ]);
  })().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}
