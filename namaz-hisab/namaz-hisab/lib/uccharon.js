// আরবি লেখা থেকে বাংলা হরফে উচ্চারণ।
//
// এটা পড়ার সহায়তা মাত্র — তাজবীদের সব নিয়ম (ইদগাম, ইখফা, মাদের মাত্রা,
// গুন্নাহ) এতে ধরা পড়ে না, আর প্রতিটি শব্দ আলাদা করে লেখা হয় বলে ছাপা
// বইয়ের টানা উচ্চারণের সাথে হুবহু মেলে না। সহীহ তিলাওয়াত কারী বা উস্তাদের
// কাছেই শিখতে হবে। আসল আরবিটা উপরেই আছে, উচ্চারণ তার নিচে সহায়ক হিসেবে।

/* ---------- হরফ ---------- */

const CONS = {
  'ب': 'ব', 'ت': 'ত', 'ث': 'ছ', 'ج': 'জ', 'ح': 'হ', 'خ': 'খ',
  'د': 'দ', 'ذ': 'য', 'ر': 'র', 'ز': 'য', 'س': 'স', 'ش': 'শ',
  'ص': 'ছ', 'ض': 'দ', 'ط': 'ত', 'ظ': 'য', 'غ': 'গ', 'ف': 'ফ',
  'ق': 'ক', 'ك': 'ক', 'ل': 'ল', 'م': 'ম', 'ن': 'ন', 'ه': 'হ',
  'ة': 'হ',
  // ওয়াও আর ইয়া ব্যঞ্জন হলে
  'و': 'ওয়', 'ي': 'ইয়',
};

// আলিফ, হামযা, আইন — এগুলোর নিজের ব্যঞ্জন-ধ্বনি বাংলায় নেই, স্বরই বসে
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
// এই লিপিতে তানভীনের খাড়া রূপগুলো
const TAN_A = 'ٗ';      // = ً
const TAN_I = 'ٖ';      // = ٍ
const TAN_U = 'ٞ';      // = ٌ

const ALIF = 'ا';
const WASLA = 'ٱ';
const WAW = 'و';
const YA = 'ي';
const LAM = 'ل';
const MAKSURA = 'ى';

// ওয়াকফ, রুকু, সিজদার চিহ্ন — পড়ার সময় ধরা হয় না
const SKIP = new Set([
  'ـ', 'ۖ', 'ۗ', 'ۘ', 'ۙ', 'ۚ', 'ۛ', 'ۜ', '۝', '۞', '۟', '۠',
  'ۣ', 'ۤ', 'ۧ', 'ۨ', '۩', '۪', '۫', '۬', 'ٓ', 'ٔ',
  'ٕ', 'ٜ', ' ',
]);

const HARAKAT = new Set([
  FATHA, KASRA, DAMMA, SUKUN, SUKUN_U, FATHATAN, KASRATAN, DAMMATAN,
  TAN_A, TAN_I, TAN_U, 'ۢ', 'ۭ',
]);

const SIGN = { a: 'া', i: 'ি', u: 'ু', ii: 'ী', uu: 'ূ' };
const LEAD = { a: 'আ', i: 'ই', u: 'উ', ii: 'ঈ', uu: 'ঊ' };
const HASANT = '্';

const isLetter = (c) => CONS[c] !== undefined || CARRIER.has(c);


/* ---------- হুরুফে মুকাত্তাআত ---------- */
// কিছু সুরার শুরুর বিচ্ছিন্ন হরফগুলো (আলিফ লাম মীম, ইয়া-সীন) ধ্বনি ধরে নয়,
// হরফের নাম ধরে পড়া হয়। তাই এই আয়াতগুলোতে সাধারণ নিয়ম খাটে না।

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

/* ---------- একটি হরফের চিহ্নগুলো পড়ি ---------- */

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
    else if ((c === 'ۢ' || c === 'ۭ') && m.vowel && !m.tanween) {
      m.tanween = m.vowel;
      m.vowel = null;
    }
    else if (c === TAN_A) m.tanween = 'a';
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

/* ---------- একটি শব্দ ---------- */

function word(src, opts) {
  const s = Array.from(src).filter((c) => !SKIP.has(c));
  const isLast = opts && opts.last;
  let out = '';
  let started = false;
  let i = 0;
  let skipShaddaAt = -1; // "আল" মিশে গেলে পরের হরফের শাদ্দা একবারই ধরব

  while (i < s.length) {
    const ch = s[i];
    if (!isLetter(ch)) {
      i += 1;
      continue;
    }

    // ---- "আল" (নির্দিষ্টতাবাচক) ----
    // শব্দের মাঝেও আসতে পারে: ওয়াল্‌, ফাল্‌, বিল্‌ — তাই এখানেই দেখি
    if ((ch === WASLA || ch === ALIF) && s[i + 1] === LAM && !readMarks(s, i + 2).shadda) {
      let k = i + 2;
      while (k < s.length && !isLetter(s[k])) k += 1;
      const nx = k < s.length ? readMarks(s, k + 1) : null;
      if (nx && nx.shadda && CONS[s[k]]) {
        // সূর্য হরফ — লাম মিশে যায়। হরফটা লাম হলে আল্লাহ, নইলে আর-রাহমান।
        out += (started ? '' : 'আ') + (s[k] === LAM ? 'ল্' : CONS[s[k]] + '-');
        if (started && s[k] !== LAM) out = out.slice(0, -1 - CONS[s[k]].length) + CONS[s[k]] + '-';
        skipShaddaAt = k;
        i = k;
      } else {
        // চন্দ্র হরফ — আল থেকেই যায়
        out += (started ? 'ল' : 'আল');
        i = i + 2;
      }
      started = true;
      continue;
    }

    const m = readMarks(s, i + 1);
    let j = m.at;
    let long = m.long;
    const shadda = m.shadda && i !== skipShaddaAt && !(i === 0 && !started);

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

    // আয়াতের শেষ শব্দে থামা হয়, তাই শেষের স্বর/তানভীন পড়া হয় না
    const atEnd = isLast && j >= s.length;
    let vowel = m.vowel;
    let tanween = m.tanween;
    if (atEnd && !long) {
      vowel = null;
      tanween = null;
    } else if (atEnd && tanween) {
      tanween = null;
    }

    if (CARRIER.has(ch)) {
      // আলিফ আগের স্বরকে টানে — নতুন কিছু যোগ করে না
      if ((ch === ALIF || ch === WASLA || ch === MAKSURA) && started && !m.vowel && !long) {
        i = j;
        continue;
      }
      if (ch === 'ع' && m.sukun) {
        out += started ? '’' : 'আ';
        started = true;
        i = j;
        continue;
      }
      const key = long || vowel || tanween || 'a';
      out += LEAD[key] || LEAD.a;
      started = true;
      if (tanween) out += 'ন';
      i = j;
      continue;
    }

    let letter = CONS[ch];
    // তা মারবুতা — থামলে "হ", টেনে পড়লে "ত"
    if (ch === 'ة') letter = isLast ? 'হ' : 'ত';
    if (m.sukun && (ch === WAW || ch === YA)) {
      // সুকুন পড়লে ওয়াও/ইয়া টানা স্বর হয়ে যায় — ইয়াওমি, আলাইহিম
      letter = ch === WAW ? 'ও' : 'ই';
    } else if (shadda) {
      // দ্বিত্ব: ইয়্যাকা, কুওওয়াত
      letter = ch === WAW ? 'ওওয়' : ch === YA ? 'ইয়্য' : letter + HASANT + letter;
    }

    out += letter;
    started = true;

    if (long) out += SIGN[long];
    else if (vowel) out += SIGN[vowel];
    else if (tanween) out += SIGN[tanween] + 'ন';
    // সুকুন হলে কিছুই বসে না — বাংলায় বদ্ধ অক্ষরে স্বর এমনিতেই পড়ে না

    i = j;
  }

  // হামযার ই আর পরের ইয়া পাশাপাশি এলে একটাই থাকে — ইয়্যাকা, ইয়্যাহু
  return out.replace(/^ইই/, 'ই');
}

/* ---------- পুরো আয়াত ---------- */

export function toBanglaUccharon(arabic, surah, ayah) {
  if (!arabic) return '';
  // বিচ্ছিন্ন হরফ থাকে শুধু আয়াতের প্রথম শব্দে; বাকিটা স্বাভাবিক নিয়মেই পড়া হয়
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
  const out = [];
  words.forEach((w, idx) => {
    const t = word(w, { last: idx === words.length - 1 });
    if (t) out.push(t);
  });
  return out.join(' ');
}

export default toBanglaUccharon;
