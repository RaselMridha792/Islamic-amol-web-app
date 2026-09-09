// হাদিস থেকে কুইজের প্রশ্ন বানিয়ে ডেটাবেসে ঢোকায়।
//   node scripts/seedHadithQuiz.mjs           — প্রশ্ন যোগ করে
//   node scripts/seedHadithQuiz.mjs --purge   — আগের কুরআনভিত্তিক প্রশ্ন মুছে তারপর যোগ করে
//
// প্রশ্নগুলো হাতে লেখা নয় — আটটি হাদিসগ্রন্থের বাংলা অনুবাদ থেকে যন্ত্রে বানানো,
// তাই কোনো হাদিস বানিয়ে লেখার সুযোগ নেই। উৎস: fawazahmed0/hadith-api (bn সংস্করণ)।
//
// দুই ধরনের প্রশ্ন হয়:
//   ১. বর্ণনাকারী — হাদিসের লেখা থেকে বর্ণনাকারীর নামটা কেটে নিয়ে জিজ্ঞেস করা হয়
//   ২. শূন্যস্থান — হাদিসের ভেতরের একটা শব্দ ঢেকে দেওয়া হয়

import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { MANUAL_QUESTIONS } from '../lib/content/questionsManual.js';

const ROOT = process.cwd();
const CACHE = path.join(ROOT, '.hadith-cache');
const BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/';

const BOOKS = {
  'ben-bukhari': 'সহীহ বুখারী',
  'ben-muslim': 'সহীহ মুসলিম',
  'ben-abudawud': 'সুনানে আবু দাউদ',
  'ben-tirmidhi': 'জামে তিরমিযী',
  'ben-nasai': 'সুনানে নাসাঈ',
  'ben-ibnmajah': 'সুনানে ইবনে মাজাহ',
  'ben-malik': 'মুয়াত্তা মালিক',
  'ben-nawawi': 'চল্লিশ হাদিস (নববী)',
};

const url = fs
  .readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  .match(/^DATABASE_URL=(.*)$/m)[1]
  .trim()
  .replace(/^["']|["']$/g, '');
const sql = neon(url);

await sql`
  create table if not exists nh_questions (
    id bigserial primary key, topic text not null, question text not null,
    options jsonb not null, answer int not null, source text not null default 'auto'
  )
`;
await sql`create unique index if not exists nh_questions_uniq on nh_questions(md5(question))`;

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
function makeQ(topic, question, correct, wrongs, source) {
  const opts = shuffle([correct, ...wrongs]);
  return { topic, question, options: opts, answer: opts.indexOf(correct), source };
}

/* ---------- হাদিস নামাই ---------- */

fs.mkdirSync(CACHE, { recursive: true });
const all = [];
for (const key of Object.keys(BOOKS)) {
  const file = path.join(CACHE, key + '.json');
  if (!fs.existsSync(file)) {
    process.stdout.write('  নামছে ' + key + ' … ');
    const res = await fetch(BASE + key + '.json');
    if (!res.ok) throw new Error(key + ' -> ' + res.status);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log('হলো');
  }
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const h of d.hadiths) {
    const text = (h.text || '').replace(/\s+/g, ' ').trim();
    if (text.length < 60) continue;
    all.push({ book: BOOKS[key], num: h.hadithnumber, text });
  }
}
console.log('ব্যবহারযোগ্য হাদিস:', all.length);

// লেখাটা লম্বা হলে ছেঁটে দিই, নইলে ফোনের পর্দায় ধরে না
const trim = (t, n = 380) => (t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, '') + '…');

// অনুবাদ-সংস্করণে হাদিসের সাথে প্রকাশক আর মান যাচাইয়ের নোট মিশে থাকে।
// প্রশ্নে সেগুলো থাকলে পড়তে অসুবিধা হয়, আর উত্তরও ফাঁস হয়ে যেতে পারে।
function clean(t) {
  return t
    .replace(/\([^)]*(?:আধুনিক প্রকাশনী|ইসলামিক ফাউন্ডেশন|ইঃফাঃ|আঃপ্রঃ)[^)]*\)/g, ' ')
    .replace(/আবূ\s*[‘']?ঈসা\s*বলেন[^।]*।/g, ' ')
    .replace(/(?:সহীহঃ|যঈফঃ|হাসান সহীহঃ|যঈফ,|সহীহ,)[^।]*।/g, ' ')
    .replace(/(?:সহীহ|যঈফ|হাসান সহীহ|হাসান|গারীব)\s*।\s*$/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*(?:হাঃ|হাদীস নং|মুসলিম \d|বুখারী \d|আহমাদ \d)[^)]*\)/g, ' ')
    .replace(/(?:মুত্তাফাকুন আলাইহি|তাহকীক আলবানী)[^।]*।?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// সনদের শেকল: "আযহার ইবন জামিল (রহঃ) ... ইবন আব্বাস (রাঃ) থেকে" — এই "..." টুকু বাদ
const hasChain = (t) => /\.{3,}|…/.test(t.slice(0, 160));

/* ---------- ১) বর্ণনাকারী ---------- */

const NARRATOR = [
  /(?:^|।\s*)([^।]{3,45}?)\s*\((?:রাঃ|রাযিঃ|রা\.|রহ\.|রাদিয়াল্লাহু আনহু)\)\s*(?:হতে|থেকে)\s*বর্ণিত/,
  /(?:^|।\s*)([^।]{3,45}?)\s*\((?:রাঃ|রাযিঃ|রা\.|রহ\.)\)\s*বলেন/,
];

const cleanName = (n) =>
  n
    .replace(/^[\s"'“”‘’(),.:;-]+/, '')
    .replace(/[\s"'“”‘’(),.:;-]+$/, '')
    .replace(/্$/, '')
    .replace(/\s+/g, ' ')
    .trim();

const narr = [];
const nameCount = new Map();
for (const h of all) {
  const text = clean(h.text);
  // সনদের শেকল থাকলে বাদ — ওখান থেকে ঠিক নামটা বের করা যায় না
  if (hasChain(text)) continue;
  for (const re of NARRATOR) {
    const m = text.slice(0, 160).match(re);
    if (!m) continue;
    // বর্ণনাকারীর কথাটা একেবারে শুরুতেই থাকতে হবে, নইলে মাঝের কারো নাম উঠে আসে
    if (text.indexOf(m[0]) > 25) break;
    const name = cleanName(m[1]);
    if (name.length < 4 || name.length > 30) break;
    if (/[০-৯0-9(){}\[\].…]/.test(name)) break;
    if (name.split(' ').length > 5) break;
    // "... থেকে বর্ণিত আছে, তিনি বলেন" — নামটা কাটার পর "আছে," পড়ে থাকে
    const rest = text
      .slice(text.indexOf(m[0]) + m[0].length)
      .replace(/^[।\s,ঃ:]+/, '')
      .replace(/^আছে\s*(?:যে)?\s*[,ঃ:।]?\s*/, '')
      .replace(/^(?:তিনি\s+বলেন|বলেন)\s*[,ঃ:।]?\s*/, '')
      .trim();
    // বাকি লেখাটা যেন একটা পূর্ণ বাক্য দিয়ে শুরু হয়
    if (rest.length < 90) break;
    narr.push({ ...h, name, rest });
    nameCount.set(name, (nameCount.get(name) || 0) + 1);
    break;
  }
}
// অন্তত ৫ বার আসা নাম থেকেই ভুল অপশন নেব, নইলে অপশনগুলো অচেনা হয়ে যায়
const pool = [...nameCount.entries()].filter(([, c]) => c >= 5).map(([n]) => n);
const questions = [];

for (const h of narr) {
  if (nameCount.get(h.name) < 5) continue;
  const wrongs = [];
  let guard = 0;
  while (wrongs.length < 3 && guard < 40) {
    guard += 1;
    const w = pick(pool);
    if (w !== h.name && !wrongs.includes(w)) wrongs.push(w);
  }
  if (wrongs.length < 3) continue;
  questions.push(
    makeQ(
      'বর্ণনাকারী',
      `এই হাদিসটি কে বর্ণনা করেছেন?\n\n“${trim(h.rest)}”\n\n— ${h.book}`,
      h.name,
      wrongs,
      'hadith'
    )
  );
}
console.log('বর্ণনাকারীর প্রশ্ন:', questions.length);

/* ---------- ২) শূন্যস্থান ---------- */

const STOP = new Set(
  'এই ওই সেই তার তাঁর আমি আমার তিনি তোমার তোমরা যে যা এবং আর কিন্তু তবে যখন তখন করে হয়ে থেকে হতে জন্য সাথে পরে আগে না নেই ছিল বলেন বলেছেন করেন করলেন হলেন এরপর অতঃপর তাহলে যদি কেউ কোন কোনো সব সকল'.split(' ')
);
// বাংলা অঙ্কও এই ব্লকেই থাকে, তাই আলাদা করে বাদ দিই — নইলে
// "[মুসলিম ৩৯/১৫]" থেকে "৩৯১৫" উত্তর হয়ে বসে
const bare = (w) => w.replace(/[^ঀ-৿]/g, '').replace(/[০-৯]/g, '');

// সব হাদিস থেকে শব্দের একটা ভাণ্ডার, ভুল অপশন বানাতে
const wordPool = [];
for (const h of all) {
  for (const w of h.text.split(/\s+/)) {
    const c = bare(w);
    if (c.length >= 4 && c.length <= 12 && !STOP.has(c)) wordPool.push(c);
  }
}

let blankCount = 0;
for (const h of all) {
  const text = clean(h.text).replace(/^[।\s,ঃ:]+/, '');
  if (text.length < 140 || text.length > 520) continue;
  if (hasChain(text)) continue;
  const words = text.split(' ');
  // একবারই আছে এমন শব্দ বাছি — নইলে বাক্যের অন্য জায়গায় উত্তরটা দেখা যাবে।
  // আর শুরুর এক-তৃতীয়াংশ বাদ, নইলে "_____ আব্বাস (রাঃ) হতে বর্ণিত" এর মতো হয়।
  const from = Math.max(4, Math.floor(words.length / 3));
  const idxs = [];
  words.forEach((w, i) => {
    if (i < from) return;
    const c = bare(w);
    if (c.length < 4 || c.length > 12 || STOP.has(c)) return;
    if (words.filter((x) => bare(x) === c).length !== 1) return;
    idxs.push(i);
  });
  if (idxs.length < 5) continue;

  const at = idxs[Math.floor(rnd() * idxs.length)];
  const answer = bare(words[at]);
  const shown = words.slice();
  shown[at] = words[at].replace(answer, '_____');

  const wrongs = [];
  let guard = 0;
  while (wrongs.length < 3 && guard < 60) {
    guard += 1;
    const w = pick(wordPool);
    if (w !== answer && !wrongs.includes(w) && !text.includes(w)) wrongs.push(w);
  }
  if (wrongs.length < 3) continue;

  questions.push(
    makeQ(
      'হাদিসের পাঠ',
      `শূন্যস্থানে কোন শব্দটি বসবে?\n\n“${trim(shown.join(' '), 420)}”\n\n— ${h.book}`,
      answer,
      wrongs,
      'hadith'
    )
  );
  blankCount += 1;
}
console.log('শূন্যস্থানের প্রশ্ন:', blankCount);

/* ---------- ৩) হাতে লেখা ---------- */

MANUAL_QUESTIONS.forEach((q) => questions.push({ ...q, source: 'manual' }));

/* ---------- ঢোকানো ---------- */

// শেষ ছাঁকনি। অনুবাদ-সংস্করণগুলোতে নোট লেখার ধরন এক রকম নয়, তাই কিছু
// রয়ে যায়। সেগুলোর পেছনে না ছুটে, যাতে এখনো আবর্জনা আছে সেই প্রশ্নগুলোই
// বাদ দিয়ে দিই — ২৩ হাজারের মধ্যে গুটিকয় বাদ গেলে ক্ষতি নেই, কিন্তু
// একটা খারাপ প্রশ্নও যেন কারও সামনে না পড়ে।
const JUNK = [
  /আধুনিক প্রকাশনী/, /ইসলামিক ফাউন্ডেশন/, /আবূ\s*[‘']?ঈসা\s*বলেন/,
  /\.{3,}|…\s*[^”]{0,40}\(রহ/, /মিশকাত\s*\(/, /সহীহাহ\s*\(/,
  /তাহকীক/, /পূর্বেরটির/, /হাদীস নং/, /যঈফ/, /মুত্তাফাকুন/,
];
const seen = new Set();
const finalQs = questions.filter((q) => {
  if (seen.has(q.question)) return false;
  if (q.source !== 'manual') {
    if (JUNK.some((re) => re.test(q.question))) return false;
    // উত্তর বা কোনো অপশনে সংখ্যা থাকলে সেটা রেফারেন্স, শব্দ নয়
    if (q.options.some((o) => /[০-৯0-9]/.test(o))) return false;
  }
  seen.add(q.question);
  return true;
});

if (process.argv.includes('--purge')) {
  // 'auto' = আগের কুরআনভিত্তিক, 'hadith' = আগের বারের হাদিসের প্রশ্ন।
  // দুটোই মুছে দিই, নইলে পুরনো কম-মানের প্রশ্নগুলো রয়ে যায়।
  const gone = await sql`delete from nh_questions where source in ('auto', 'hadith') returning id`;
  console.log('পুরনো প্রশ্ন মোছা হলো:', gone.length);
}

console.log('তৈরি হলো:', finalQs.length);
const byTopic = {};
finalQs.forEach((q) => { byTopic[q.topic] = (byTopic[q.topic] || 0) + 1; });
console.log('বিষয় ধরে:', byTopic);

const BATCH = 500;
let inserted = 0;
for (let i = 0; i < finalQs.length; i += BATCH) {
  const slice = finalQs.slice(i, i + BATCH);
  const res = await sql.query(
    `insert into nh_questions (topic, question, options, answer, source)
     select t->>'topic', t->>'question', t->'options', (t->>'answer')::int, t->>'source'
     from jsonb_array_elements($1::jsonb) as t
     on conflict do nothing returning id`,
    [JSON.stringify(slice)]
  );
  inserted += res.length;
  if ((i / BATCH) % 10 === 0) console.log('  …', i + slice.length, '/', finalQs.length);
}

const total = await sql`select count(*)::int as n from nh_questions`;
const bySrc = await sql`select source, count(*)::int as n from nh_questions group by source`;
console.log('নতুন ঢুকল:', inserted);
console.log('ডেটাবেসে মোট:', total[0].n, '| উৎস ধরে:', JSON.stringify(bySrc));
