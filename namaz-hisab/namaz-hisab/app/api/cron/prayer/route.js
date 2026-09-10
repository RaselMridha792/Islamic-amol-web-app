import { NextResponse } from 'next/server';
import { db, ensureSchema, hasDb } from '../../../../lib/db';
import { todayKey } from '../../../../lib/api';
import { pushReady, sendToUser } from '../../../../lib/push';
import {
  DEFAULT_PLACE,
  QURAN_AFTER_FAJR_MIN,
  SLOTS,
  hhmm,
  timesFor,
} from '../../../../lib/prayerTimes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ওয়াক্ত ঢোকার কত মিনিটের মধ্যে পাঠাব। cron একটু দেরিতে চললেও যেন ধরা পড়ে,
// আবার অনেক পরে গিয়ে অসময়ে যেন না বাজে।
const WINDOW_MIN = 20;

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

  const now = new Date();
  const day = todayKey();

  try {
    await ensureSchema();
    const sql = db();

    // যাঁদের নোটিফিকেশন চালু আর অন্তত একটা ডিভাইস যোগ করা আছে
    const users = await sql`
      select u.id, u.lat, u.lng, u.notify_prayer, u.notify_quran
      from nh_users u
      where (u.notify_prayer or u.notify_quran)
        and exists (select 1 from nh_push p where p.user_id = u.id)
    `;

    let sent = 0;
    const done = [];

    for (const u of users) {
      const lat = u.lat === null ? DEFAULT_PLACE.lat : Number(u.lat);
      const lng = u.lng === null ? DEFAULT_PLACE.lng : Number(u.lng);
      const t = timesFor(lat, lng, now);

      // আজ কোনগুলো পাঠানো হয়ে গেছে
      const already = await sql`
        select slot from nh_notified where user_id = ${u.id} and day = ${day}
      `;
      const seen = new Set(already.map((r) => r.slot));

      const jobs = [];
      if (u.notify_prayer) {
        SLOTS.forEach((s) => {
          jobs.push({
            slot: s.id,
            at: t[s.id],
            title: s.bn + 'র সময় হয়েছে',
            body: `${s.bn} — ${hhmm(t[s.id])}। পড়া হলে খাতায় লিখে রাখুন।`,
            url: '/',
          });
        });
      }
      if (u.notify_quran) {
        jobs.push({
          slot: 'quran',
          at: new Date(t.fajr.getTime() + QURAN_AFTER_FAJR_MIN * 60000),
          title: 'কুরআন পড়ার সময়',
          body: 'ফজরের পর একটু কুরআন — অল্প হলেও প্রতিদিন।',
          url: '/quran',
        });
      }

      for (const j of jobs) {
        if (seen.has(j.slot)) continue;
        const late = (now.getTime() - j.at.getTime()) / 60000;
        // সময় হয়ে গেছে, কিন্তু বেশি দেরি হয়ে যায়নি
        if (late < 0 || late > WINDOW_MIN) continue;

        // আগে লিখি, তারপর পাঠাই — cron দুবার চললেও দুবার যাবে না
        const put = await sql`
          insert into nh_notified (user_id, day, slot)
          values (${u.id}, ${day}, ${j.slot})
          on conflict do nothing
          returning slot
        `;
        if (!put.length) continue;

        const res = await sendToUser(Number(u.id), {
          title: j.title,
          body: j.body,
          url: j.url,
          tag: j.slot,
        });
        sent += res.sent;
        done.push({ user: Number(u.id), slot: j.slot });
      }
    }

    // পুরনো হিসাব জমতে দিই না
    await sql`delete from nh_notified where day < (current_date - interval '7 days')`;

    return NextResponse.json({ day, users: users.length, sent, done });
  } catch (err) {
    return NextResponse.json({ error: 'পাঠানো গেল না' }, { status: 503 });
  }
}
