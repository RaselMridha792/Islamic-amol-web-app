import { NextResponse } from 'next/server';
import { db, ensureSchema, hasDb } from '../../../lib/db';
import { COOKIE, userFromToken } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_DAYS_PER_PUSH = 500;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

async function requireUser(req) {
  if (!hasDb()) return { error: NextResponse.json({ cloud: false }, { status: 503 }) };
  const token = req.cookies.get(COOKIE)?.value;
  const user = await userFromToken(token);
  if (!user) return { error: NextResponse.json({ error: 'লগইন করা নেই' }, { status: 401 }) };
  return { user };
}

// পুরো খাতা নামিয়ে আনি
export async function GET(req) {
  let gate;
  try {
    gate = await requireUser(req);
  } catch (err) {
    return NextResponse.json({ error: 'ডেটাবেসে পৌঁছানো গেল না' }, { status: 503 });
  }
  if (gate.error) return gate.error;

  try {
    const sql = db();
    const [dayRows, profRows] = await Promise.all([
      sql`select to_char(day, 'YYYY-MM-DD') as day, data, updated_at from nh_days where user_id = ${gate.user.id}`,
      sql`select people, updated_at from nh_profile where user_id = ${gate.user.id} limit 1`,
    ]);

    const days = {};
    dayRows.forEach((r) => {
      days[r.day] = { data: r.data || {}, updatedAt: Number(r.updated_at) };
    });
    const prof = profRows[0]
      ? { people: profRows[0].people || null, updatedAt: Number(profRows[0].updated_at) }
      : null;

    return NextResponse.json({ days, profile: prof });
  } catch (err) {
    return NextResponse.json({ error: 'খাতা আনা গেল না' }, { status: 503 });
  }
}

// বদলে যাওয়া দিনগুলো উপরে পাঠাই — পুরনো লেখা নতুনটাকে চাপা দেবে না
export async function POST(req) {
  let gate;
  try {
    gate = await requireUser(req);
  } catch (err) {
    return NextResponse.json({ error: 'ডেটাবেসে পৌঁছানো গেল না' }, { status: 503 });
  }
  if (gate.error) return gate.error;

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: 'অনুরোধটা পড়া গেল না' }, { status: 400 });
  }

  try {
    await ensureSchema();
    const sql = db();
    const uid = gate.user.id;

    if (body.wipe) {
      await sql`delete from nh_days where user_id = ${uid}`;
    }

    const list = Array.isArray(body.days) ? body.days.slice(0, MAX_DAYS_PER_PUSH) : [];
    const clean = [];
    list.forEach((d) => {
      if (!d || !DAY_RE.test(d.day)) return;
      const at = Number(d.updatedAt);
      if (!Number.isFinite(at)) return;
      clean.push({ day: d.day, data: d.data || {}, at: Math.round(at) });
    });

    // পুরো তালিকা একটাই jsonb হয়ে যায়, তাই কতগুলো দিন এল তাতে ক্যোয়ারি বদলায় না
    if (clean.length) {
      await sql.query(
        `insert into nh_days (user_id, day, data, updated_at)
         select $1, (t->>'day')::date, t->'data', (t->>'at')::bigint
         from jsonb_array_elements($2::jsonb) as t
         on conflict (user_id, day) do update
           set data = excluded.data, updated_at = excluded.updated_at
           where excluded.updated_at > nh_days.updated_at`,
        [uid, JSON.stringify(clean)]
      );
    }

    if (body.profile && body.profile.people) {
      const at = Math.round(Number(body.profile.updatedAt) || Date.now());
      await sql`
        insert into nh_profile (user_id, people, updated_at)
        values (${uid}, ${JSON.stringify(body.profile.people)}::jsonb, ${at})
        on conflict (user_id) do update
          set people = excluded.people, updated_at = excluded.updated_at
          where excluded.updated_at > nh_profile.updated_at
      `;
    }

    return NextResponse.json({ ok: true, saved: clean.length });
  } catch (err) {
    return NextResponse.json({ error: 'খাতা জমা দেওয়া গেল না' }, { status: 503 });
  }
}
