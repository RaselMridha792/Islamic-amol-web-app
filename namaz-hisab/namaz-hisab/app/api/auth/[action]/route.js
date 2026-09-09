import { NextResponse } from 'next/server';
import { db, ensureSchema, hasDb } from '../../../../lib/db';
import {
  COOKIE,
  checkPassword,
  checkUsername,
  cookieOptions,
  createSession,
  destroySession,
  hashPassword,
  userFromToken,
  verifyPassword,
} from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function offline() {
  // ডেটাবেস সেট করা না থাকলে অ্যাপ শুধু এই ফোনেই চলবে, ভাঙবে না
  return NextResponse.json({ cloud: false, user: null });
}

function fail(message, status = 400) {
  return NextResponse.json({ cloud: hasDb(), error: message }, { status });
}

export async function GET(req, ctx) {
  const { action } = await ctx.params;
  if (action !== 'me') return fail('not-found', 404);
  if (!hasDb()) return offline();
  try {
    const token = req.cookies.get(COOKIE)?.value;
    const user = await userFromToken(token);
    if (!user) return NextResponse.json({ cloud: true, user: null });
    // ছবিটা এখানেই দিয়ে দিই — নইলে অ্যাপ খোলার সময় আরেকটা আলাদা অনুরোধ লাগত
    const rows = await db()`select people from nh_profile where user_id = ${user.id} limit 1`;
    const people = rows[0] && rows[0].people ? rows[0].people : {};
    return NextResponse.json({ cloud: true, user: { ...user, photo: people.photo || '' } });
  } catch (err) {
    return fail('ডেটাবেসে পৌঁছানো গেল না', 503);
  }
}

export async function POST(req, ctx) {
  const { action } = await ctx.params;

  if (action === 'logout') {
    const res = NextResponse.json({ cloud: hasDb(), user: null });
    const token = req.cookies.get(COOKIE)?.value;
    if (hasDb() && token) {
      try {
        await destroySession(token);
      } catch (err) {
        // সেশন মুছতে না পারলেও কুকি সরিয়ে দিলে এই ডিভাইসে লগআউট হয়ে যাবে
      }
    }
    res.cookies.set(COOKIE, '', { ...cookieOptions(new Date(0)), maxAge: 0 });
    return res;
  }

  if (action !== 'login' && action !== 'register') return fail('not-found', 404);
  if (!hasDb()) return fail('সার্ভারে ডেটাবেস যুক্ত করা হয়নি', 503);

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return fail('অনুরোধটা পড়া গেল না');
  }

  const uname = checkUsername(body.username);
  if (!uname.ok) return fail(uname.error);
  const pw = checkPassword(body.password);
  if (!pw.ok) return fail(pw.error);

  try {
    await ensureSchema();
    const sql = db();
    let user;

    if (action === 'register') {
      const taken = await sql`select id from nh_users where username = ${uname.value} limit 1`;
      if (taken.length) return fail('এই ইউজারনেম আগেই নেওয়া হয়েছে');
      const name = String(body.displayName || '').trim().slice(0, 24) || uname.value;
      const rows = await sql`
        insert into nh_users (username, pass_hash, display_name)
        values (${uname.value}, ${hashPassword(pw.value)}, ${name})
        returning id, username, display_name
      `;
      user = { id: rows[0].id, username: rows[0].username, name: rows[0].display_name };
    } else {
      const rows = await sql`
        select id, username, pass_hash, display_name from nh_users where username = ${uname.value} limit 1
      `;
      const found = rows[0];
      // ইউজারনেম ভুল না পাসওয়ার্ড ভুল, সেটা আলাদা করে বলি না
      if (!found || !verifyPassword(pw.value, found.pass_hash)) {
        return fail('ইউজারনেম বা পাসওয়ার্ড মিলছে না', 401);
      }
      user = { id: found.id, username: found.username, name: found.display_name || found.username };
    }

    const { token, expires } = await createSession(user.id);
    const res = NextResponse.json({ cloud: true, user });
    res.cookies.set(COOKIE, token, cookieOptions(expires));
    return res;
  } catch (err) {
    return fail('ডেটাবেসে পৌঁছানো গেল না', 503);
  }
}
