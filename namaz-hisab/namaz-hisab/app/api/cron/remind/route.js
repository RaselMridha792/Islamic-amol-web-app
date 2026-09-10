import { NextResponse } from 'next/server';
import { db, ensureSchema, hasDb } from '../../../../lib/db';
import { todayKey } from '../../../../lib/api';
import { pushReady, sendToUser } from '../../../../lib/push';
import { PRAYERS } from '../../../../lib/prayers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// রোজকার মনে করিয়ে দেওয়া। Vercel এর cron এটা ডাকে (vercel.json দেখুন)।
// বাইরের কেউ যেন ডাকতে না পারে, তাই CRON_SECRET মেলাতে হয়।
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  const given =
    req.headers.get('authorization') === `Bearer ${secret}` ||
    new URL(req.url).searchParams.get('key') === secret;
  if (!secret || !given) {
    return NextResponse.json({ error: 'অনুমতি নেই' }, { status: 401 });
  }
  if (!hasDb() || !pushReady()) {
    return NextResponse.json({ error: 'সেট করা নেই' }, { status: 503 });
  }

  const day = todayKey();
  try {
    await ensureSchema();
    const sql = db();
    // যাঁদের নোটিফিকেশন চালু আছে, তাঁদের আজকের নামাজের হিসাব দেখি
    const rows = await sql`
      select u.id, u.display_name, u.username, d.data
      from nh_users u
      join (select distinct user_id from nh_push) p on p.user_id = u.id
      left join nh_days d on d.user_id = u.id and d.day = ${day}
    `;

    let sent = 0;
    for (const r of rows) {
      const rec = r.data || {};
      const left = PRAYERS.filter((x) => !rec[x.id]);
      if (!left.length) continue; // সব লেখা হয়ে গেছে, বিরক্ত করার দরকার নেই
      const res = await sendToUser(Number(r.id), {
        title: 'আজকের খাতা',
        body:
          left.length === PRAYERS.length
            ? 'আজ এখনো কোনো ওয়াক্ত লেখা হয়নি।'
            : `আজ ${left.map((x) => x.bn).join(', ')} এখনো লেখা হয়নি।`,
        url: '/',
      });
      sent += res.sent;
    }
    return NextResponse.json({ day, users: rows.length, sent });
  } catch (err) {
    return NextResponse.json({ error: 'পাঠানো গেল না' }, { status: 503 });
  }
}
