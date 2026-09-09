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
    await sql`
      create table if not exists nh_users (
        id          bigserial primary key,
        username    text not null unique,
        pass_hash   text not null,
        created_at  timestamptz not null default now()
      )
    `;
    await sql`
      create table if not exists nh_sessions (
        token_hash  text primary key,
        user_id     bigint not null references nh_users(id) on delete cascade,
        expires_at  timestamptz not null,
        created_at  timestamptz not null default now()
      )
    `;
    await sql`create index if not exists nh_sessions_user_idx on nh_sessions(user_id)`;
    await sql`
      create table if not exists nh_days (
        user_id     bigint not null references nh_users(id) on delete cascade,
        day         date not null,
        data        jsonb not null default '{}'::jsonb,
        updated_at  bigint not null,
        primary key (user_id, day)
      )
    `;
    await sql`
      create table if not exists nh_profile (
        user_id     bigint primary key references nh_users(id) on delete cascade,
        people      jsonb not null default '{}'::jsonb,
        updated_at  bigint not null
      )
    `;
  })().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}
