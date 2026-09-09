import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { fail, readBody, requireUser } from '../../../lib/api';
import { JUZ_RANGE, SURAHS, juzOf } from '../../../lib/quranMeta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MARK = 300;

// কতটুকু পড়া হলো — মোট আয়াত আর কয়টা পারা পুরো শেষ
export async function quranSummary(sql, userId) {
  const rows = await sql`
    select juz, count(*)::int as n from nh_quran where user_id = ${userId} group by juz
  `;
  const byJuz = new Map(rows.map((r) => [Number(r.juz), r.n]));
  let total = 0;
  let doneJuz = 0;
  JUZ_RANGE.forEach((j) => {
    const n = byJuz.get(j.juz) || 0;
    total += n;
    if (n >= j.count) doneJuz += 1;
  });
  return { ayahs: total, juzDone: doneJuz, juzTotal: JUZ_RANGE.length };
}

export async function GET(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  const surah = Number(new URL(req.url).searchParams.get('surah') || 0);

  try {
    const sql = db();
    const summary = await quranSummary(sql, gate.user.id);
    let ayahs = [];
    if (surah >= 1 && surah <= 114) {
      const rows = await sql`
        select ayah from nh_quran where user_id = ${gate.user.id} and surah = ${surah}
      `;
      ayahs = rows.map((r) => Number(r.ayah));
    }
    return NextResponse.json({ summary, surah, ayahs });
  } catch (err) {
    return fail('পড়ার হিসাব আনা গেল না', 503);
  }
}

// আয়াত পড়া হিসেবে চিহ্ন দেওয়া বা তুলে নেওয়া
export async function POST(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  const body = await readBody(req);
  if (!body) return fail('অনুরোধটা পড়া গেল না');

  const surah = Number(body.surah);
  if (!(surah >= 1 && surah <= 114)) return fail('সুরার নম্বর ঠিক নেই');
  const limit = SURAHS[surah - 1].ayahs;

  const list = Array.isArray(body.ayahs) ? body.ayahs.slice(0, MAX_MARK) : [];
  const ayahs = [...new Set(list.map(Number).filter((a) => a >= 1 && a <= limit))];
  if (!ayahs.length) return fail('কোন আয়াত, সেটা বলা হয়নি');

  try {
    const sql = db();
    if (body.read === false) {
      await sql.query(
        `delete from nh_quran where user_id = $1 and surah = $2
         and ayah = any($3::int[])`,
        [gate.user.id, surah, ayahs]
      );
    } else {
      const rows = ayahs.map((a) => ({ a, j: juzOf(surah, a) }));
      await sql.query(
        `insert into nh_quran (user_id, surah, ayah, juz)
         select $1, $2, (t->>'a')::int, (t->>'j')::int
         from jsonb_array_elements($3::jsonb) as t
         on conflict (user_id, surah, ayah) do nothing`,
        [gate.user.id, surah, JSON.stringify(rows)]
      );
    }
    return NextResponse.json({ summary: await quranSummary(sql, gate.user.id) });
  } catch (err) {
    return fail('হিসাব রাখা গেল না', 503);
  }
}
