// রোজকার কুইজের সহজ ও মাঝারি প্রশ্ন বানায়।
//   node scripts/seedIslamicQuiz.mjs           — যোগ করে
//   node scripts/seedIslamicQuiz.mjs --purge   — আগের সহজ/মাঝারিগুলো মুছে নতুন করে বসায়
//
// হাদিসের কঠিন প্রশ্নগুলো (বর্ণনাকারী, শূন্যস্থান) এই স্ক্রিপ্ট ছোঁয় না —
// সেগুলো level='hard', আর রোজকার কুইজে আসে না।
//
// দুই উৎস, দুটোই যাচাই করা:
//   ১. কুরআনের সুরার তথ্য ও নামাজের রাকাত — অ্যাপের নিজের ডেটা থেকে
//   ২. হাতে লেখা মৌলিক প্রশ্ন — শুধু সেসব বিষয় যেগুলো নিয়ে মতভেদ নেই

import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { MANUAL_QUESTIONS } from '../lib/content/questionsManual.js';
import { BASIC_QUESTIONS } from '../lib/content/questionsBasics.js';
import { SURAHS, juzOf } from '../lib/quranMeta.js';
import { surahBn } from '../lib/content/surahNames.js';
import { PRAYERS, totalRakat } from '../lib/prayers.js';

const ROOT = process.cwd();
const url = fs
  .readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  .match(/^DATABASE_URL=(.*)$/m)[1]
  .trim()
  .replace(/^["']|["']$/g, '');
const sql = neon(url);

await sql`alter table nh_questions add column if not exists level text not null default 'easy'`;
await sql`create index if not exists nh_questions_level on nh_questions(level)`;

/* ---------- এলোমেলো, কিন্তু প্রতিবার একই ---------- */

let seed = 20260910;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = (a) => a[Math.floor(rnd() * a.length)];
function shuffle(a) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}
function makeQ(topic, question, correct, wrongs, level) {
  const opts = shuffle([correct, ...wrongs]);
  return { topic, question, options: opts, answer: opts.indexOf(correct), source: 'basic', level };
}
const bn = (n) => String(n).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);

// একটা তালিকা থেকে তিনটে আলাদা ভুল অপশন
function others(list, correct, n = 3) {
  const out = [];
  let guard = 0;
  while (out.length < n && guard < 200) {
    guard += 1;
    const v = pick(list);
    if (v !== correct && !out.includes(v)) out.push(v);
  }
  return out.length === n ? out : null;
}

const questions = [];
const name = (s) => `সুরা ${surahBn(s.id)}`;
const allNames = SURAHS.map(name);
const allMeanings = [...new Set(SURAHS.map((s) => s.bn))];

/* ---------- সুরার তথ্য ---------- */

SURAHS.forEach((s) => {
  // নাম থেকে অর্থ — শেখার মতো, আর সহজ
  const w1 = others(allMeanings, s.bn);
  if (w1) questions.push(makeQ('সুরা', `${name(s)} শব্দের অর্থ কী?`, s.bn, w1, 'easy'));

  // অর্থ থেকে নাম
  const w2 = others(allNames, name(s));
  if (w2) questions.push(makeQ('সুরা', `"${s.bn}" — এটি কোন সুরার অর্থ?`, name(s), w2, 'easy'));

  // মাক্কি না মাদানি
  const right = s.type === 'meccan' ? 'মাক্কি' : 'মাদানি';
  const two = shuffle(['মাক্কি', 'মাদানি']);
  questions.push({
    topic: 'সুরা',
    question: `${name(s)} মাক্কি না মাদানি?`,
    options: two,
    answer: two.indexOf(right),
    source: 'basic',
    level: 'easy',
  });

  // নম্বর থেকে নাম, নাম থেকে নম্বর
  const w3 = others(allNames, name(s));
  if (w3) questions.push(makeQ('সুরা', `কুরআনের ${bn(s.id)} নম্বর সুরা কোনটি?`, name(s), w3, 'medium'));

  const nums = [];
  let g = 0;
  while (nums.length < 3 && g < 60) {
    g += 1;
    const v = 1 + Math.floor(rnd() * 114);
    if (v !== s.id && !nums.includes(bn(v))) nums.push(bn(v));
  }
  if (nums.length === 3) {
    questions.push(makeQ('সুরা', `${name(s)} কুরআনের কত নম্বর সুরা?`, bn(s.id), nums, 'medium'));
  }

  // আয়াত সংখ্যা
  const counts = [];
  g = 0;
  while (counts.length < 3 && g < 60) {
    g += 1;
    const v = s.ayahs + (Math.floor(rnd() * 40) - 20);
    if (v > 0 && v !== s.ayahs && !counts.includes(bn(v))) counts.push(bn(v));
  }
  if (counts.length === 3) {
    questions.push(makeQ('সুরা', `${name(s)} এ কয়টি আয়াত আছে?`, bn(s.ayahs), counts, 'medium'));
  }

  // কোন পারায় শুরু
  const j = juzOf(s.id, 1);
  const juzWrong = [];
  g = 0;
  while (juzWrong.length < 3 && g < 60) {
    g += 1;
    const v = 1 + Math.floor(rnd() * 30);
    if (v !== j && !juzWrong.includes(bn(v))) juzWrong.push(bn(v));
  }
  if (juzWrong.length === 3) {
    questions.push(makeQ('পারা', `${name(s)} কুরআনের কত নম্বর পারায় শুরু হয়েছে?`, bn(j), juzWrong, 'medium'));
  }
});

/* ---------- আম্মা পারার আয়াতের অর্থ ---------- */
// শেষ পারাটা অনেকেই মুখস্থ করেন, তাই এগুলো ধরার মতো

const meanings = [];
for (let i = 78; i <= 114; i += 1) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/quran', i + '.json'), 'utf8'));
  d.verses.forEach((v) => {
    if (v.translation && v.translation.length >= 25) meanings.push(v.translation);
  });
}
for (let i = 78; i <= 114; i += 1) {
  const s = SURAHS[i - 1];
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/quran', i + '.json'), 'utf8'));
  d.verses.forEach((v) => {
    if (!v.translation || v.translation.length < 25) return;
    const w = others(meanings, v.translation);
    if (!w) return;
    questions.push(
      makeQ('আয়াত', `${name(s)} এর ${bn(v.id)} নম্বর আয়াতের অর্থ কোনটি?`, v.translation, w, 'medium')
    );
  });
}

/* ---------- নামাজের রাকাত ---------- */

const rakatWrong = (right) => {
  const out = [];
  let g = 0;
  while (out.length < 3 && g < 40) {
    g += 1;
    const v = 1 + Math.floor(rnd() * 20);
    if (v !== right && !out.includes(bn(v))) out.push(bn(v));
  }
  return out.length === 3 ? out : null;
};

PRAYERS.forEach((p) => {
  const farz = p.parts.filter((x) => x.tone === 'farz').reduce((a, b) => a + b.n, 0);
  const w1 = rakatWrong(farz);
  if (w1) questions.push(makeQ('নামাজ', `${p.gen} ফরজ কয় রাকাত?`, bn(farz), w1, 'easy'));

  const tot = totalRakat(p);
  const w2 = rakatWrong(tot);
  if (w2) {
    questions.push(
      makeQ('নামাজ', `${p.bn} ওয়াক্তে সুন্নত-নফলসহ সব মিলিয়ে কয় রাকাত?`, bn(tot), w2, 'medium')
    );
  }

  const sunnah = p.parts.filter((x) => x.tone === 'sunnah').reduce((a, b) => a + b.n, 0);
  if (sunnah > 0) {
    const w3 = rakatWrong(sunnah);
    if (w3) questions.push(makeQ('নামাজ', `${p.gen} সুন্নত সব মিলিয়ে কয় রাকাত?`, bn(sunnah), w3, 'medium'));
  }

  const times = others(PRAYERS.map((x) => x.waqt), p.waqt);
  if (times) questions.push(makeQ('নামাজ', `${p.bn} কোন সময়ের নামাজ?`, p.waqt, times, 'easy'));
});

/* ---------- হাতে লেখা ---------- */

MANUAL_QUESTIONS.forEach((q) => questions.push({ ...q, source: 'manual', level: 'easy' }));
BASIC_QUESTIONS.forEach((q) => questions.push({ ...q, source: 'manual', level: 'easy' }));

/* ---------- ঢোকানো ---------- */

const seen = new Set();
const finalQs = questions.filter((q) => {
  if (!q.options || q.options.length < 2) return false;
  if (new Set(q.options).size !== q.options.length) return false;
  if (q.answer < 0 || q.answer >= q.options.length) return false;
  if (seen.has(q.question)) return false;
  seen.add(q.question);
  return true;
});

if (process.argv.includes('--purge')) {
  const gone = await sql`delete from nh_questions where level in ('easy','medium') returning id`;
  console.log('আগের সহজ/মাঝারি মোছা হলো:', gone.length);
}

const byLevel = {};
finalQs.forEach((q) => { byLevel[q.level] = (byLevel[q.level] || 0) + 1; });
console.log('তৈরি হলো:', finalQs.length, '| স্তর ধরে:', byLevel);

const BATCH = 500;
let inserted = 0;
for (let i = 0; i < finalQs.length; i += BATCH) {
  const slice = finalQs.slice(i, i + BATCH);
  const res = await sql.query(
    `insert into nh_questions (topic, question, options, answer, source, level)
     select t->>'topic', t->>'question', t->'options', (t->>'answer')::int, t->>'source', t->>'level'
     from jsonb_array_elements($1::jsonb) as t
     on conflict do nothing returning id`,
    [JSON.stringify(slice)]
  );
  inserted += res.length;
}

const tot = await sql`select level, count(*)::int as n from nh_questions group by level order by level`;
console.log('নতুন ঢুকল:', inserted);
console.log('ডেটাবেসে স্তর ধরে:', JSON.stringify(tot));
