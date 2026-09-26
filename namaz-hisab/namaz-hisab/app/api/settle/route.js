import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { fail, readBody, requireUser, todayKey } from '../../../lib/api';
import { monthSummary } from '../../../lib/prayers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// মাস শেষে জরিমানা মেটানো।
//
// প্রতি মাসে দুজনের জরিমানা আলাদা করে গোনা হয় (নামাজের খাতার একই নিয়মে —
// দিন পেরোলে না-লেখা ওয়াক্ত "পড়েনি")। যাঁর বেশি, তিনি পার্থক্যটা অন্যজনকে
// দেবেন। মাস শেষ না হওয়া পর্যন্ত সেটা "চলতি"; শেষ হলে "বাকি", যতক্ষণ না
// কেউ "পরিশোধ হয়েছে" দেন। পরের মাস আবার শূন্য থেকে — প্রতিটা মাস নিজের হিসাব।
//
// পরিশোধের সময়ের অঙ্কটা রেখে দিই। পরে সেই মাসের কোনো দিনের হিসাব বদলালে অঙ্ক
// আর মেলে না — তখন "বদলেছে" দেখাই, যাতে চুপচাপ ভুল কিছু "পরিশোধিত" না থাকে।

const YM_RE = /^\d{4}-\d{2}$/;

function nextYm(ym) {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

// জোড়া — দুদিক থেকেই বাঁধা থাকতে হবে
async function pairOf(sql, me, partnerId) {
  if (!partnerId) return null;
  const rows = await sql`
    select id, partner_id, coalesce(display_name, username) as name,
           to_char(missed_from, 'YYYY-MM-DD') as missed_from
    from nh_users where id in (${me}, ${partnerId})
  `;
  const mine = rows.find((r) => Number(r.id) === me);
  const theirs = rows.find((r) => Number(r.id) === partnerId);
  if (!mine || !theirs || Number(theirs.partner_id) !== me) return null;
  return {
    me: { id: me, name: mine.name, missedFrom: mine.missed_from },
    partner: { id: partnerId, name: theirs.name, missedFrom: theirs.missed_from },
    lo: Math.min(me, partnerId),
    hi: Math.max(me, partnerId),
  };
}

// আমার দিক থেকে: ধনাত্মক = আমি দেব, ঋণাত্মক = আমি পাব
const signed = (payer, amount) => (payer === 'me' ? amount : payer === 'partner' ? -amount : 0);

async function build(sql, pair, today) {
  const [rows, paidRows] = await Promise.all([
    sql`
      select user_id, to_char(day, 'YYYY-MM-DD') as day, data from nh_days
      where user_id in (${pair.me.id}, ${pair.partner.id})
    `,
    sql`
      select month, payer_id, amount, paid_by, paid_at from nh_settle
      where user_a = ${pair.lo} and user_b = ${pair.hi}
    `,
  ]);

  const days = { [pair.me.id]: {}, [pair.partner.id]: {} };
  let first = null;
  rows.forEach((r) => {
    days[Number(r.user_id)][r.day] = r.data || {};
    if (!first || r.day < first) first = r.day;
  });
  [pair.me.missedFrom, pair.partner.missedFrom].forEach((d) => {
    if (d && (!first || d < first)) first = d;
  });

  const current = today.slice(0, 7);
  const paid = new Map(paidRows.map((r) => [r.month, r]));
  const who = (id) => (id === null || id === undefined ? null : Number(id) === pair.me.id ? 'me' : 'partner');

  const months = [];
  for (let ym = (first || today).slice(0, 7); ym <= current; ym = nextYm(ym)) {
    const mine = monthSummary(days[pair.me.id], ym, today, pair.me.missedFrom).fine;
    const theirs = monthSummary(days[pair.partner.id], ym, today, pair.partner.missedFrom).fine;
    const diff = mine - theirs;
    const amount = Math.abs(diff);
    const payer = diff > 0 ? 'me' : diff < 0 ? 'partner' : null;

    const rec = paid.get(ym) || null;
    const record = rec
      ? {
          amount: rec.amount,
          payer: who(rec.payer_id),
          by: who(rec.paid_by),
          at: new Date(rec.paid_at).toISOString(),
        }
      : null;

    let status;
    if (ym === current) status = 'running';
    else if (record && record.amount === amount && record.payer === payer) status = 'paid';
    else if (record) status = 'changed';
    else status = amount === 0 ? 'even' : 'due';

    months.push({ month: ym, mine, theirs, amount, payer, status, paid: record });
  }

  // যে মাসগুলো মেটানো বাকি, সব মিলিয়ে কে কাকে কত
  let owed = 0;
  const dueMonths = [];
  months.forEach((m) => {
    if (m.status === 'due') {
      owed += signed(m.payer, m.amount);
      dueMonths.push(m.month);
    } else if (m.status === 'changed') {
      owed += signed(m.payer, m.amount) - signed(m.paid.payer, m.paid.amount);
      dueMonths.push(m.month);
    }
  });

  return {
    me: { name: pair.me.name },
    partner: { name: pair.partner.name },
    current,
    months: months.reverse(),
    due: {
      months: dueMonths,
      amount: Math.abs(owed),
      payer: owed > 0 ? 'me' : owed < 0 ? 'partner' : null,
    },
  };
}

export async function GET(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  try {
    const sql = db();
    const pair = await pairOf(sql, gate.user.id, gate.user.partnerId);
    if (!pair) return NextResponse.json({ paired: false });
    return NextResponse.json({ paired: true, ...(await build(sql, pair, todayKey())) });
  } catch (err) {
    return fail('হিসাব আনা গেল না', 503);
  }
}

// { month: 'YYYY-MM', paid: true | false }
export async function POST(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  const body = await readBody(req);
  if (!body) return fail('অনুরোধটা পড়া গেল না');

  const month = String(body.month || '');
  const today = todayKey();
  if (!YM_RE.test(month)) return fail('কোন মাস, সেটা ঠিক নেই');
  if (month >= today.slice(0, 7)) return fail('মাস শেষ হলে তবেই মেটানো যায়');

  try {
    const sql = db();
    const pair = await pairOf(sql, gate.user.id, gate.user.partnerId);
    if (!pair) return fail('আগে সঙ্গীর সাথে জোড়া বাঁধুন');

    if (body.paid === false) {
      await sql`
        delete from nh_settle where user_a = ${pair.lo} and user_b = ${pair.hi} and month = ${month}
      `;
    } else {
      // পরিশোধের মুহূর্তের অঙ্কটাই রাখি — সার্ভারে এখনই গুনে, ফোনের কথায় নয়
      const now = await build(sql, pair, today);
      const m = now.months.find((x) => x.month === month);
      if (!m) return fail('এই মাসের কোনো হিসাব নেই');
      if (m.amount === 0) return fail('এই মাসে দেওয়া-নেওয়ার কিছু নেই');
      const payerId = m.payer === 'me' ? pair.me.id : pair.partner.id;
      await sql`
        insert into nh_settle (user_a, user_b, month, payer_id, amount, paid_by, paid_at)
        values (${pair.lo}, ${pair.hi}, ${month}, ${payerId}, ${m.amount}, ${pair.me.id}, now())
        on conflict (user_a, user_b, month) do update
          set payer_id = excluded.payer_id, amount = excluded.amount,
              paid_by = excluded.paid_by, paid_at = excluded.paid_at
      `;
    }

    return NextResponse.json({ paired: true, ...(await build(sql, pair, today)) });
  } catch (err) {
    return fail('কাজটা শেষ করা গেল না', 503);
  }
}
