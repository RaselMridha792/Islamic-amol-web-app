import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { DAY_RE, fail, readBody, requireUser, todayKey } from '../../../lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// দোয়া ও আমলের টিক — দিন ধরে, নামাজের খাতার মতো। আগের যেকোনো দিনে টিক
// দেওয়া বা তোলা যায় (রাত ১২টার পরে গতকালেরটা লিখতে), শুধু সামনের দিনে নয়।

const KINDS = ['dua', 'amol'];
const YM_RE = /^\d{4}-\d{2}$/;

// দিনটা ঠিক আছে কি না — না দিলে আজ; সামনের দিন হলে null
function pickDay(value) {
  const today = todayKey();
  if (!value) return today;
  const day = String(value);
  if (!DAY_RE.test(day)) return null;
  return day > today ? null : day;
}

function nextMonthStart(ym) {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

export async function GET(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  const q = new URL(req.url).searchParams;

  try {
    const sql = db();

    /* ---- পুরো মাসে দিনে দিনে কয়টা করে — মাসের খাতার জন্য ---- */
    if (q.get('month')) {
      const month = String(q.get('month'));
      if (!YM_RE.test(month)) return fail('কোন মাস, সেটা ঠিক নেই');
      const rows = await sql`
        select to_char(day, 'YYYY-MM-DD') as day, kind, count(*)::int as n
        from nh_ticks
        where user_id = ${gate.user.id}
          and day >= ${month + '-01'}::date and day < ${nextMonthStart(month)}::date
        group by day, kind
      `;
      const days = {};
      rows.forEach((r) => {
        if (!days[r.day]) days[r.day] = { dua: 0, amol: 0 };
        if (days[r.day][r.kind] !== undefined) days[r.day][r.kind] = r.n;
      });
      return NextResponse.json({ month, days });
    }

    /* ---- একটা দিনের টিক ---- */
    const day = pickDay(q.get('day'));
    if (!day) return fail('এই দিনটা এখনো আসেনি');
    const rows = await sql`
      select kind, item from nh_ticks where user_id = ${gate.user.id} and day = ${day}
    `;
    const out = { dua: [], amol: [] };
    rows.forEach((r) => {
      if (out[r.kind]) out[r.kind].push(r.item);
    });
    return NextResponse.json({ day, ticks: out });
  } catch (err) {
    return fail('হিসাব আনা গেল না', 503);
  }
}

export async function POST(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  const body = await readBody(req);
  if (!body) return fail('অনুরোধটা পড়া গেল না');

  const kind = String(body.kind || '');
  const item = String(body.item || '').slice(0, 64);
  if (!KINDS.includes(kind) || !item) return fail('কোন জিনিসে টিক, সেটা ঠিক নেই');
  const day = pickDay(body.day);
  if (!day) {
    return fail(DAY_RE.test(String(body.day)) ? 'সামনের দিনে টিক দেওয়া যায় না' : 'তারিখটা ঠিক নেই');
  }

  try {
    const sql = db();
    if (body.on === false) {
      await sql`
        delete from nh_ticks
        where user_id = ${gate.user.id} and day = ${day} and kind = ${kind} and item = ${item}
      `;
    } else {
      await sql`
        insert into nh_ticks (user_id, day, kind, item)
        values (${gate.user.id}, ${day}, ${kind}, ${item})
        on conflict do nothing
      `;
    }
    return NextResponse.json({ ok: true, day });
  } catch (err) {
    return fail('টিক রাখা গেল না', 503);
  }
}
