// কুইজের প্রশ্ন বানিয়ে ডেটাবেসে ঢোকায়।
//   node scripts/seedQuestions.mjs
// আবার চালালে ক্ষতি নেই — একই প্রশ্ন দুবার ঢোকে না (nh_questions_uniq)।
//
// প্রশ্নগুলোর দুটো উৎস:
//   ১. হাতে লেখা — lib/content/questionsManual.js
//   ২. আসল কুরআনের ডেটা থেকে বানানো — তাই তথ্যগত ভুল হওয়ার সুযোগ নেই

import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { MANUAL_QUESTIONS } from '../lib/content/questionsManual.js';
import { SURAHS, juzOf } from '../lib/quranMeta.js';

const ROOT = process.cwd();
const url = fs
  .readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  .match(/^DATABASE_URL=(.*)$/m)[1]
  .trim()
  .replace(/^["']|["']$/g, '');
const sql = neon(url);

// অ্যাপ না চললেও যেন কাজ করে, তাই টেবিলটা এখানেই নিশ্চিত করে নিই
await sql`
  create table if not exists nh_questions (
    id        bigserial primary key,
    topic     text not null,
    question  text not null,
    options   jsonb not null,
    answer    int not null,
    source    text not null default 'auto'
  )
`;
await sql`create unique index if not exists nh_questions_uniq on nh_questions(md5(question))`;

/* ---------- এলোমেলো, কিন্তু প্রতিবার একই ---------- */
// বীজ ঠিক রাখলে বারবার চালালেও একই প্রশ্ন তৈরি হয়

let seed = 20260909;
function rnd() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
function pick(arr) {
  return arr[Math.floor(rnd() * arr.length)];
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// সঠিক উত্তর আর তিনটা ভুল অপশন মিশিয়ে একটা প্রশ্ন বানাই
function makeQ(topic, question, correct, wrongs) {
  const opts = shuffle([correct, ...wrongs]);
  return { topic, question, options: opts, answer: opts.indexOf(correct), source: 'auto' };
}

const bn = (n) => String(n).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);

/* ---------- কুরআনের ডেটা পড়ি ---------- */

const chapters = [];
for (let i = 1; i <= 114; i += 1) {
  chapters.push(JSON.parse(fs.readFileSync(path.join(ROOT, 'public/quran', i + '.json'), 'utf8')));
}

const surahName = (s) => `সুরা ${s.tr}`;
const allNames = SURAHS.map(surahName);

// একই লেখা একাধিক সুরায় থাকলে "এটা কোন সুরার?" প্রশ্নের উত্তর একটা হয় না — বাদ
const arCount = new Map();
const bnCount = new Map();
chapters.forEach((ch) => {
  ch.verses.forEach((v) => {
    arCount.set(v.text, (arCount.get(v.text) || 0) + 1);
    bnCount.set(v.translation, (bnCount.get(v.translation) || 0) + 1);
  });
});

function otherNames(exceptId, n = 3) {
  const out = [];
  while (out.length < n) {
    const s = pick(SURAHS);
    const name = surahName(s);
    if (s.id !== exceptId && !out.includes(name)) out.push(name);
  }
  return out;
}

const questions = [];

/* ---------- ১১৪ সুরা ধরে বানানো প্রশ্ন ---------- */

SURAHS.forEach((s) => {
  const name = surahName(s);

  // কয়টা আয়াত
  const wrongCounts = [];
  while (wrongCounts.length < 3) {
    const delta = Math.floor(rnd() * 40) - 20;
    const val = s.ayahs + delta;
    if (val > 0 && val !== s.ayahs && !wrongCounts.includes(bn(val))) wrongCounts.push(bn(val));
  }
  questions.push(makeQ('কুরআন', `${name} এ কয়টি আয়াত আছে?`, bn(s.ayahs), wrongCounts));

  // মাক্কি না মাদানি
  const isMakki = s.type === 'meccan';
  questions.push({
    topic: 'কুরআন',
    question: `${name} মাক্কি না মাদানি?`,
    options: ['মাক্কি', 'মাদানি'],
    answer: isMakki ? 0 : 1,
    source: 'auto',
  });

  // নম্বর থেকে নাম
  questions.push(
    makeQ('কুরআন', `কুরআনের ${bn(s.id)} নম্বর সুরা কোনটি?`, name, otherNames(s.id))
  );

  // নাম থেকে নম্বর
  const wrongNums = [];
  while (wrongNums.length < 3) {
    const v = 1 + Math.floor(rnd() * 114);
    if (v !== s.id && !wrongNums.includes(bn(v))) wrongNums.push(bn(v));
  }
  questions.push(makeQ('কুরআন', `${name} কুরআনের কত নম্বর সুরা?`, bn(s.id), wrongNums));

  // বাংলা অর্থ
  const wrongMeanings = [];
  while (wrongMeanings.length < 3) {
    const o = pick(SURAHS);
    if (o.id !== s.id && o.bn !== s.bn && !wrongMeanings.includes(o.bn)) wrongMeanings.push(o.bn);
  }
  questions.push(makeQ('কুরআন', `${name} শব্দের অর্থ কী?`, s.bn, wrongMeanings));

  // কোন পারায় শুরু
  const startJuz = juzOf(s.id, 1);
  const wrongJuz = [];
  while (wrongJuz.length < 3) {
    const v = 1 + Math.floor(rnd() * 30);
    if (v !== startJuz && !wrongJuz.includes(bn(v))) wrongJuz.push(bn(v));
  }
  questions.push(makeQ('কুরআন', `${name} কুরআনের কত নম্বর পারায় শুরু হয়েছে?`, bn(startJuz), wrongJuz));
});

/* ---------- আয়াত ধরে বানানো প্রশ্ন ---------- */

chapters.forEach((ch) => {
  const s = SURAHS[ch.id - 1];
  const name = surahName(s);

  ch.verses.forEach((v) => {
    // ক) বাংলা অর্থ দেখে সুরা চেনা — ছোট বা একাধিক জায়গায় থাকা আয়াত বাদ
    if (v.translation.length >= 40 && bnCount.get(v.translation) === 1) {
      questions.push(
        makeQ(
          'আয়াত',
          `এই অর্থটি কোন সুরার আয়াতের?\n\n“${v.translation}”`,
          name,
          otherNames(s.id)
        )
      );
    }

    // খ) আরবি দেখে সুরা চেনা
    if (v.text.length >= 35 && arCount.get(v.text) === 1) {
      questions.push(
        makeQ('আয়াত', `এই আয়াতটি কোন সুরার?\n\n${v.text}`, name, otherNames(s.id))
      );
    }

    // গ) সুরা ও আয়াত নম্বর দেখে অর্থ বাছা
    if (v.translation.length >= 45 && bnCount.get(v.translation) === 1) {
      const wrongs = [];
      let guard = 0;
      while (wrongs.length < 3 && guard < 60) {
        guard += 1;
        const oc = pick(chapters);
        const ov = pick(oc.verses);
        if (ov.translation !== v.translation && ov.translation.length >= 40 && !wrongs.includes(ov.translation)) {
          wrongs.push(ov.translation);
        }
      }
      if (wrongs.length === 3) {
        questions.push(
          makeQ(
            'আয়াত',
            `${name} এর ${bn(v.id)} নম্বর আয়াতের অর্থ কোনটি?`,
            v.translation,
            wrongs
          )
        );
      }
    }
  });
});

/* ---------- পারা চেনা ---------- */

chapters.forEach((ch) => {
  const s = SURAHS[ch.id - 1];
  // প্রতি সুরা থেকে অল্প কিছু, নইলে একই ধরনের প্রশ্ন খুব বেশি হয়ে যায়
  const step = Math.max(1, Math.floor(ch.verses.length / 10));
  for (let i = 0; i < ch.verses.length; i += step) {
    const v = ch.verses[i];
    const j = juzOf(s.id, v.id);
    const wrongs = [];
    while (wrongs.length < 3) {
      const x = 1 + Math.floor(rnd() * 30);
      if (x !== j && !wrongs.includes(bn(x))) wrongs.push(bn(x));
    }
    questions.push(
      makeQ('পারা', `সুরা ${s.tr} এর ${bn(v.id)} নম্বর আয়াত কোন পারায়?`, bn(j), wrongs)
    );
  }
});

/* ---------- উল্টো দিক: সুরা ও নম্বর দেখে আরবি আয়াত বাছা ---------- */
// প্রশ্নে আয়াত নম্বর থাকে বলে প্রতিটা প্রশ্ন আলাদা — নইলে এক সুরার সব প্রশ্ন
// একই লেখা হয়ে যেত আর ছাঁটাইয়ে বাদ পড়ত

chapters.forEach((ch) => {
  const s = SURAHS[ch.id - 1];
  ch.verses.forEach((v) => {
    if (v.text.length < 35 || arCount.get(v.text) !== 1) return;
    const wrongs = [];
    let guard = 0;
    while (wrongs.length < 3 && guard < 60) {
      guard += 1;
      const oc = pick(chapters);
      if (oc.id === ch.id) continue;
      const ov = pick(oc.verses);
      if (ov.text.length >= 35 && !wrongs.includes(ov.text)) wrongs.push(ov.text);
    }
    if (wrongs.length === 3) {
      questions.push(
        makeQ('আয়াত', `সুরা ${s.tr} এর ${bn(v.id)} নম্বর আয়াতটি কোনটি?`, v.text, wrongs)
      );
    }
  });
});

/* ---------- হাতে লেখাগুলো ---------- */

MANUAL_QUESTIONS.forEach((q) => {
  questions.push({ ...q, source: 'manual' });
});

/* ---------- ঢোকানো ---------- */

// একই প্রশ্ন-লেখা দুবার থাকলে এখানেই ছেঁটে ফেলি
const seen = new Set();
const finalQs = questions.filter((q) => {
  if (seen.has(q.question)) return false;
  seen.add(q.question);
  return true;
});

console.log('তৈরি হলো:', finalQs.length, 'টি প্রশ্ন');
const byTopic = {};
finalQs.forEach((q) => { byTopic[q.topic] = (byTopic[q.topic] || 0) + 1; });
console.log('বিষয় ধরে:', byTopic);
console.log('হাতে লেখা:', finalQs.filter((q) => q.source === 'manual').length);

const BATCH = 500;
let inserted = 0;
for (let i = 0; i < finalQs.length; i += BATCH) {
  const slice = finalQs.slice(i, i + BATCH);
  const res = await sql.query(
    `insert into nh_questions (topic, question, options, answer, source)
     select t->>'topic', t->>'question', t->'options', (t->>'answer')::int, t->>'source'
     from jsonb_array_elements($1::jsonb) as t
     on conflict do nothing
     returning id`,
    [JSON.stringify(slice)]
  );
  inserted += res.length;
  if ((i / BATCH) % 10 === 0) console.log('  ...', i + slice.length, '/', finalQs.length);
}

const total = await sql`select count(*)::int as n from nh_questions`;
console.log('নতুন ঢুকল:', inserted);
console.log('ডেটাবেসে এখন মোট:', total[0].n, 'টি প্রশ্ন');
