import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { fail, requireUser, todayKey } from '../../../lib/api';
import { POINTS } from '../../../lib/points';
import { JUZ_RANGE } from '../../../lib/quranMeta';
import { PRAYERS, dayCounts, dayTotal } from '../../../lib/prayers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// একজনের সব হিসাব এক জায়গায়
async function statsFor(sql, user, day) {
  const month = day.slice(0, 7);
  const uid = user.id;

  const [quran, ticks, quiz, quizAll, days] = await Promise.all([
    sql`select juz, count(*)::int as n from nh_quran where user_id = ${uid} group by juz`,
    sql`
      select kind,
             count(*)::int as n_all,
             (count(*) filter (where day = ${day}))::int as n_today
      from nh_ticks where user_id = ${uid} group by kind
    `,
    sql`
      select count(*)::int as n from nh_quiz_answer
      where user_id = ${uid} and day = ${day} and correct
    `,
    sql`select count(*)::int as n from nh_quiz_answer where user_id = ${uid} and correct`,
    sql`
      select to_char(day, 'YYYY-MM-DD') as day, data from nh_days
      where user_id = ${uid} and to_char(day, 'YYYY-MM') = ${month}
    `,
  ]);

  // কুরআন: কয় আয়াত, কয় পারা পুরো শেষ
  const byJuz = new Map(quran.map((r) => [Number(r.juz), r.n]));
  let ayahs = 0;
  let juzDone = 0;
  JUZ_RANGE.forEach((j) => {
    const n = byJuz.get(j.juz) || 0;
    ayahs += n;
    if (n >= j.count) juzDone += 1;
  });

  // দোয়া ও আমলের টিক — আজকের আর সব মিলিয়ে
  const tick = { duaToday: 0, amolToday: 0, duaAll: 0, amolAll: 0 };
  ticks.forEach((r) => {
    const key = r.kind === 'dua' ? 'dua' : 'amol';
    tick[key + 'All'] += r.n_all;
    tick[key + 'Today'] += r.n_today;
  });

  // নামাজ: এ মাসের জরিমানা আর আজ কয় ওয়াক্ত লেখা হয়েছে
  let monthFine = 0;
  const monthCount = { prayed: 0, qaza: 0, missed: 0 };
  let todayFilled = 0;
  days.forEach((r) => {
    const rec = r.data || {};
    monthFine += dayTotal(rec);
    const c = dayCounts(rec);
    monthCount.prayed += c.prayed;
    monthCount.qaza += c.qaza;
    monthCount.missed += c.missed;
    if (r.day === day) todayFilled = PRAYERS.filter((p) => rec[p.id]).length;
  });

  const pointsToday =
    quiz[0].n * POINTS.quiz + tick.duaToday * POINTS.dua + tick.amolToday * POINTS.amol;
  const pointsTotal =
    quizAll[0].n * POINTS.quiz + tick.duaAll * POINTS.dua + tick.amolAll * POINTS.amol;

  return {
    id: uid,
    name: user.display_name || user.username,
    username: user.username,
    quran: { ayahs, juzDone, juzTotal: JUZ_RANGE.length },
    today: {
      dua: tick.duaToday,
      amol: tick.amolToday,
      quiz: quiz[0].n,
      namaz: todayFilled,
    },
    points: { today: pointsToday, total: pointsTotal },
    namaz: { monthFine, monthCount },
  };
}

export async function GET(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  const day = todayKey();

  try {
    const sql = db();
    // নিজের আর শুধু নিজের সঙ্গীর সারি — আর কারও নয়
    const rows = await sql`
      select u.id, u.username, u.display_name, u.partner_id
      from nh_users u where u.id = ${gate.user.id} limit 1
    `;
    const me = rows[0];
    if (!me) return fail('আপনাকে খুঁজে পাওয়া গেল না', 404);

    let partnerRow = null;
    if (me.partner_id) {
      const p = await sql`
        select id, username, display_name from nh_users where id = ${me.partner_id} limit 1
      `;
      partnerRow = p[0] || null;
    }

    const [mine, theirs] = await Promise.all([
      statsFor(sql, me, day),
      partnerRow ? statsFor(sql, partnerRow, day) : Promise.resolve(null),
    ]);

    return NextResponse.json({ day, me: mine, partner: theirs });
  } catch (err) {
    return fail('ড্যাশবোর্ড আনা গেল না', 503);
  }
}
