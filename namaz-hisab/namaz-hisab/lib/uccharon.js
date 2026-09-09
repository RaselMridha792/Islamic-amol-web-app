// আরবি লেখা থেকে বাংলা হরফে উচ্চারণ।
//
// ছাপা বইয়ের মতো টেনে লেখা হয় — "বিসমিল্লাহির রাহমানির রাহীম",
// শব্দ ধরে ধরে "বিসমি আল্লাহি আর-রাহমানি আর-রাহীম" নয়। নিয়মটা হলো:
// "আল" এর ব্যঞ্জনটা আগের শব্দের লেজে জোড়া লাগে, আর নামটা নতুন শব্দ হয়ে বসে।
//
// তবু এটা পড়ার সহায়তা মাত্র। তাজবীদের সব নিয়ম (ইদগাম, ইখফা, মাদের মাত্রা,
// গুন্নাহ) এতে ধরা পড়ে না। সহীহ তিলাওয়াত কারী বা উস্তাদের কাছেই শিখতে হবে।
// আসল আরবিটা উপরেই আছে, উচ্চারণ তার নিচে সহায়ক হিসেবে।

/* ---------- হরফ ---------- */

const CONS = {
  'ب': 'ব', 'ت': 'ত', 'ث': 'ছ', 'ج': 'জ', 'ح': 'হ', 'خ': 'খ',
  'د': 'দ', 'ذ': 'য', 'ر': 'র', 'ز': 'য', 'س': 'স', 'ش': 'শ',
  'ص': 'স', 'ض': 'দ', 'ط': 'ত', 'ظ': 'য', 'غ': 'গ', 'ف': 'ফ',
  'ق': 'ক', 'ك': 'ক', 'ل': 'ল', 'م': 'ম', 'ن': 'ন', 'ه': 'হ',
  'ة': 'হ',
  'و': 'ওয়', 'ي': 'ইয়',
};

// আলিফ, হামযা, আইন — নিজের ব্যঞ্জনধ্বনি বাংলায় নেই, স্বরই বসে
const CARRIER = new Set(['ا', 'ٱ', 'ى', 'ء', 'أ', 'إ', 'ؤ', 'ئ', 'ع']);

const FATHA = 'َ';
const KASRA = 'ِ';
const DAMMA = 'ُ';
const SUKUN = 'ْ';
const SUKUN_U = 'ۡ';
const SHADDA = 'ّ';
const FATHATAN = 'ً';
const KASRATAN = 'ٍ';
const DAMMATAN = 'ٌ';
const SUP_ALIF = 'ٰ';   // ছোট আলিফ — দীর্ঘ আ
const SMALL_WAW = 'ۥ';  // ছোট ওয়াও — দীর্ঘ ঊ
const SMALL_YA = 'ۦ';   // ছোট ইয়া — দীর্ঘ ঈ
// এই লিপিতে তানভীনের খাড়া রূপ — ডেটাসেটের ল্যাটিন উচ্চারণের সাথে মিলিয়ে যাচাই করা
const TAN_A = 'ٗ';
const TAN_I = 'ٖ';
const TAN_U = 'ٞ';
const IQLAB = 'ۢ';
const IQLAB2 = 'ۭ';

const ALIF = 'ا';
const WASLA = 'ٱ';
const WAW = 'و';
const YA = 'ي';
const LAM = 'ل';
const HA = 'ه';
const MAKSURA = 'ى';

// ওয়াকফ, রুকু, সিজদার চিহ্ন — পড়ার সময় ধরা হয় না
const SKIP = new Set([
  'ـ', 'ۖ', 'ۗ', 'ۘ', 'ۙ', 'ۚ', 'ۛ', 'ۜ', '۝', '۞', '۟', '۠',
  'ۣ', 'ۤ', 'ۧ', 'ۨ', '۩', '۪', '۫', '۬', 'ٓ', 'ٔ', 'ٕ', 'ٜ', ' ',
]);

const HARAKAT = new Set([
  FATHA, KASRA, DAMMA, SUKUN, SUKUN_U, FATHATAN, KASRATAN, DAMMATAN,
  TAN_A, TAN_I, TAN_U, IQLAB, IQLAB2,
]);

const SIGN = { a: 'া', i: 'ি', u: 'ু', ii: 'ী', uu: 'ূ' };
const LEAD = { a: 'আ', i: 'ই', u: 'উ', ii: 'ঈ', uu: 'ঊ' };
const HASANT = '্';

const isLetter = (c) => CONS[c] !== undefined || CARRIER.has(c);

/* ---------- হুরুফে মুকাত্তাআত ---------- */
// কিছু সুরার শুরুর বিচ্ছিন্ন হরফ (আলিফ লাম মীম, ইয়া-সীন) ধ্বনি ধরে নয়,
// হরফের নাম ধরে পড়া হয়

const LETTER_NAMES = {
  'ا': 'আলিফ', 'ل': 'লাম', 'م': 'মীম', 'ص': 'সদ', 'ر': 'রা',
  'ك': 'কাফ', 'ه': 'হা', 'ي': 'ইয়া', 'ع': 'আইন', 'ط': 'ত্বা',
  'س': 'সীন', 'ح': 'হা', 'ق': 'ক্বাফ', 'ن': 'নূন',
};

const MUQATTAAT = new Set([
  '2:1', '3:1', '7:1', '10:1', '11:1', '12:1', '13:1', '14:1', '15:1',
  '19:1', '20:1', '26:1', '27:1', '28:1', '29:1', '30:1', '31:1', '32:1',
  '36:1', '38:1', '40:1', '41:1', '42:1', '42:2', '43:1', '44:1', '45:1',
  '46:1', '50:1', '68:1',
]);

/* ---------- একটি হরফের চিহ্নগুলো ---------- */

function readMarks(s, from) {
  const m = { shadda: false, vowel: null, tanween: null, sukun: false, long: null, at: from };
  let j = from;
  while (j < s.length) {
    const c = s[j];
    if (c === SHADDA) m.shadda = true;
    else if (c === FATHA) m.vowel = 'a';
    else if (c === KASRA) m.vowel = 'i';
    else if (c === DAMMA) m.vowel = 'u';
    else if (c === SUKUN || c === SUKUN_U) m.sukun = true;
    else if (c === FATHATAN) m.tanween = 'a';
    else if (c === KASRATAN) m.tanween = 'i';
    else if (c === DAMMATAN) m.tanween = 'u';
    else if ((c === IQLAB || c === IQLAB2) && m.vowel && !m.tanween) {
      m.tanween = m.vowel;
      m.vowel = null;
    } else if (c === TAN_A) m.tanween = 'a';
    else if (c === TAN_I) m.tanween = 'i';
    else if (c === TAN_U) m.tanween = 'u';
    else if (c === SUP_ALIF) m.long = 'a';
    else if (c === SMALL_YA) m.long = 'ii';
    else if (c === SMALL_WAW) m.long = 'uu';
    else break;
    j += 1;
  }
  m.at = j;
  return m;
}

/* ---------- হরফের সারি বাংলায় ---------- */

function render(s, from, opts) {
  const stop = opts.stop; // আয়াতের শেষ শব্দ — থামা হয়, তাই শেষ স্বর পড়া হয় না
  const skipShaddaAt = opts.skipShaddaAt === undefined ? -1 : opts.skipShaddaAt;
  let out = '';
  let started = Boolean(opts.started);
  let i = from;

  while (i < s.length) {
    const ch = s[i];
    if (!isLetter(ch)) {
      i += 1;
      continue;
    }

    const m = readMarks(s, i + 1);
    let j = m.at;
    let long = m.long;
    const shadda = m.shadda && i !== skipShaddaAt && !(i === from && !opts.started);

    // পরের হরফ দেখে দীর্ঘ স্বর: َا = আ, ِي = ঈ, ُو = ঊ
    if (!long && !m.sukun) {
      const nx = s[j];
      const after = s[j + 1];
      const bare = nx !== undefined && !HARAKAT.has(after) && after !== SHADDA;
      if (bare) {
        if (m.vowel === 'a' && (nx === ALIF || nx === MAKSURA)) { long = 'a'; j += 1; }
        else if (m.vowel === 'i' && nx === YA) { long = 'ii'; j += 1; }
        else if (m.vowel === 'u' && nx === WAW) { long = 'uu'; j += 1; }
      }
    }

    const atEnd = stop && j >= s.length;
    let vowel = m.vowel;
    let tanween = m.tanween;
    if (atEnd) {
      tanween = null;
      if (!long) vowel = null;
    }

    if (CARRIER.has(ch)) {
      // আলিফ আগের স্বরকে টানে, নতুন কিছু যোগ করে না
      if ((ch === ALIF || ch === WASLA || ch === MAKSURA) && started && !m.vowel && !long) {
        i = j;
        continue;
      }
      // সুকুনযুক্ত আইন — বাংলায় ঊর্ধ্বকমা দিয়ে লেখা হয়: আ’তাইনাকা
      if (ch === 'ع' && m.sukun) {
        out += started ? '’' : 'আ';
        started = true;
        i = j;
        continue;
      }
      const helper = ch === WASLA && !started && !m.vowel && !long ? 'i' : 'a';
      out += LEAD[long || vowel || tanween || helper] || LEAD.a;
      started = true;
      if (tanween) out += 'ন';
      i = j;
      continue;
    }

    let letter = CONS[ch];
    if (ch === 'ة') letter = stop ? 'হ' : 'ত'; // তা মারবুতা: থামলে হ, টানলে ত
    if (m.sukun && (ch === WAW || ch === YA)) {
      letter = ch === WAW ? 'ও' : 'ই'; // ইয়াওমি, আলাইহিম
    } else if (shadda) {
      letter = ch === WAW ? 'ওওয়' : ch === YA ? 'ইয়্য' : letter + HASANT + letter;
    }

    out += letter;
    started = true;

    if (long) out += SIGN[long];
    else if (vowel) out += SIGN[vowel];
    else if (tanween) out += SIGN[tanween] + 'ন';
    // সুকুনে কিছু বসে না — বাংলায় বদ্ধ অক্ষরে স্বর এমনিতেই পড়ে না

    i = j;
  }

  return out;
}

/* ---------- শব্দটা আগেরটার সাথে কীভাবে জুড়বে ---------- */

function analyze(src) {
  const s = Array.from(src).filter((c) => !SKIP.has(c));
  const at = [];
  s.forEach((c, k) => { if (isLetter(c)) at.push(k); });

  const out = { s, allah: false, article: null, from: 0, skipShaddaAt: -1, lead: null };

  // শব্দের প্রথম হরফে শাদ্দা মানে ইদগাম — আগের শব্দের শেষ "ন" এই হরফে মিশে যায়।
  // উসমানি লিপিতে ব্যাপারটা এই শাদ্দা দিয়েই লেখা থাকে।
  if (at.length && CONS[s[at[0]]] && readMarks(s, at[0] + 1).shadda) {
    out.lead = CONS[s[at[0]]];
  }
  if (s[0] !== WASLA || at.length < 2 || s[at[1]] !== LAM) return out;

  // আল্লাহ — এটা "আল" + নাম নয়, গোটাটাই একটা নাম; পুরোটাই আগের শব্দে মিশে যায়
  if (at.length >= 4 && s[at[2]] === LAM && s[at[3]] === HA) {
    out.allah = true;
    out.from = at[2];
    return out;
  }

  // লামটা নিজেই শাদ্দা বইলে সেটা "আল" নয় (আল্লাযী)
  if (readMarks(s, at[1] + 1).shadda) return out;
  if (at[2] === undefined) return out;

  const k = at[2];
  if (readMarks(s, k + 1).shadda && CONS[s[k]]) {
    out.article = CONS[s[k]]; // সূর্য হরফ — লাম মিশে যায়
    out.from = k;
    out.skipShaddaAt = k;
  } else {
    out.article = 'ল'; // চন্দ্র হরফ
    out.from = at[1] + 1;
  }
  return out;
}

/* ---------- পুরো আয়াত ---------- */

export function toBanglaUccharon(arabic, surah, ayah) {
  if (!arabic) return '';

  // বিচ্ছিন্ন হরফ থাকে শুধু আয়াতের প্রথম শব্দে; বাকিটা স্বাভাবিক নিয়মেই
  if (surah && MUQATTAAT.has(surah + ':' + ayah)) {
    const parts = String(arabic).split(/\s+/).filter(Boolean);
    const names = Array.from(parts[0] || '')
      .filter((c) => LETTER_NAMES[c])
      .map((c) => LETTER_NAMES[c])
      .join(' ');
    const rest = parts.slice(1).join(' ');
    return rest ? names + ' — ' + toBanglaUccharon(rest) : names;
  }

  const words = String(arabic).split(/\s+/).filter(Boolean);
  const chunks = [];
  let cur = '';

  const flush = () => {
    if (cur) chunks.push(cur);
    cur = '';
  };

  words.forEach((w, idx) => {
    const first = idx === 0;
    const stop = idx === words.length - 1;
    const a = analyze(w);

    // আল্লাহ — আগের শব্দের সাথে মিশে যায়: বিসমি + ল্লাহি = বিসমিল্লাহি
    if (a.allah) {
      const body = render(a.s, a.from, { stop, started: true });
      if (first || !cur) {
        flush();
        cur = 'আ' + body;
      } else {
        cur += body;
      }
      return;
    }

    // "আল" — ব্যঞ্জনটা আগের শব্দের লেজে, নামটা নতুন শব্দ:
    // রাব্বি + ল = রাব্বিল, তারপর আলামীন
    if (a.article) {
      const body = render(a.s, a.from, { stop, skipShaddaAt: a.skipShaddaAt });
      if (first || !cur) {
        // আয়াতের শুরুতে: চন্দ্র হরফে "আল" নামের সাথেই থাকে (আলহামদু),
        // সূর্য হরফে আলাদা শব্দ হয় (আর রাহমান)
        flush();
        if (a.skipShaddaAt >= 0) {
          chunks.push('আ' + a.article);
          cur = body;
        } else {
          cur = 'আল' + body;
        }
      } else {
        cur += a.article;
        flush();
        cur = body;
      }
      return;
    }

    const t = render(a.s, 0, { stop });
    if (!t) return;

    // ইদগাম: আগের শব্দ "ন" দিয়ে শেষ (নূন সাকিন বা তানভীন) আর এই শব্দ শুরু
    // হচ্ছে শাদ্দাওয়ালা হরফ দিয়ে — তখন "ন" ওই হরফে বদলে যায়।
    // ইয়াকুন + ল্লাহূ = ইয়াকুল লাহূ, মিন + র্রাব্বি = মির রাব্বি
    if (a.lead && cur && cur.endsWith('ন')) {
      chunks.push(cur.slice(0, -1) + a.lead);
      cur = t;
      return;
    }

    flush();
    cur = t;
  });

  flush();
  return chunks.join(' ').replace(/ইই/g, 'ই');
}

export default toBanglaUccharon;
