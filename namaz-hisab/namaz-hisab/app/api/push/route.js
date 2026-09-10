import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { fail, readBody, requireUser } from '../../../lib/api';
import { pushReady, sendToUser } from '../../../lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// এই ডিভাইসে নোটিফিকেশন চালু আছে কিনা
export async function GET(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  const endpoint = new URL(req.url).searchParams.get('endpoint') || '';
  try {
    const sql = db();
    const rows = endpoint
      ? await sql`select 1 from nh_push where endpoint = ${endpoint} and user_id = ${gate.user.id} limit 1`
      : [];
    const all = await sql`select count(*)::int as n from nh_push where user_id = ${gate.user.id}`;
    return NextResponse.json({ ready: pushReady(), on: rows.length > 0, devices: all[0].n });
  } catch (err) {
    return fail('দেখা গেল না', 503);
  }
}

export async function POST(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  const body = await readBody(req);
  if (!body) return fail('অনুরোধটা পড়া গেল না');

  const sql = db();

  try {
    /* ---- এই ডিভাইসটা যোগ করি ---- */
    if (body.action === 'subscribe') {
      const sub = body.subscription;
      if (!sub || !sub.endpoint || !sub.keys) return fail('ঠিকানাটা ঠিক নেই');
      await sql`
        insert into nh_push (endpoint, user_id, p256dh, auth)
        values (${sub.endpoint}, ${gate.user.id}, ${sub.keys.p256dh}, ${sub.keys.auth})
        on conflict (endpoint) do update
          set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
      `;
      return NextResponse.json({ on: true });
    }

    /* ---- সরিয়ে দিই ---- */
    if (body.action === 'unsubscribe') {
      if (body.endpoint) {
        await sql`delete from nh_push where endpoint = ${body.endpoint} and user_id = ${gate.user.id}`;
      }
      return NextResponse.json({ on: false });
    }

    /* ---- পরীক্ষা করে দেখা ---- */
    if (body.action === 'test') {
      const res = await sendToUser(gate.user.id, {
        title: 'একসাথে দ্বীনের পথে',
        body: 'নোটিফিকেশন কাজ করছে, আলহামদুলিল্লাহ।',
        url: '/',
      });
      return NextResponse.json(res);
    }

    return fail('অজানা অনুরোধ');
  } catch (err) {
    return fail('কাজটা শেষ করা গেল না', 503);
  }
}
