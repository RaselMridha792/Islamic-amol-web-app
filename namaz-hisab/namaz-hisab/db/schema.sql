-- নামাজ হিসাব — Neon (Postgres) টেবিল
-- অ্যাপ প্রথম অনুরোধেই এগুলো নিজে বানিয়ে নেয় (lib/db.js → ensureSchema),
-- তাই এই ফাইলটা শুধু হাতে চালানোর বা দেখে নেওয়ার জন্য।

create table if not exists nh_users (
  id          bigserial primary key,
  username    text not null unique,
  pass_hash   text not null,             -- scrypt: s1$<salt hex>$<key hex>
  created_at  timestamptz not null default now()
);

create table if not exists nh_sessions (
  token_hash  text primary key,          -- কুকির টোকেনের sha256, আসল টোকেন কোথাও রাখি না
  user_id     bigint not null references nh_users(id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists nh_sessions_user_idx on nh_sessions(user_id);

create table if not exists nh_days (
  user_id     bigint not null references nh_users(id) on delete cascade,
  day         date not null,
  data        jsonb not null default '{}'::jsonb,   -- { p1: { fajr: 'prayed', ... }, p2: {...} }
  updated_at  bigint not null,                      -- মিলিসেকেন্ড, কোন কপি নতুন তা এতে বুঝি
  primary key (user_id, day)
);

create table if not exists nh_profile (
  user_id     bigint primary key references nh_users(id) on delete cascade,
  people      jsonb not null default '{}'::jsonb,   -- { p1: { name, photo }, p2: {...} }
  updated_at  bigint not null
);

-- মেয়াদ পেরোনো সেশন সাফ করতে চাইলে:
-- delete from nh_sessions where expires_at < now();
