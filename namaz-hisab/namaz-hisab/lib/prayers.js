// রাকাতের হিসাব হানাফি মাযহাব অনুযায়ী, বাংলাদেশে যেভাবে প্রচলিত।
// tone: ফরজ ও ওয়াজিব আলাদা করে দেখানোর জন্য।
export const PRAYERS = [
  {
    id: 'fajr', bn: 'ফজর', gen: 'ফজরের', ar: 'الفجر', waqt: 'ভোর', rakat: '২ রাকাত ফরজ',
    parts: [
      { n: 2, kind: 'সুন্নত', tone: 'sunnah' },
      { n: 2, kind: 'ফরজ', tone: 'farz' },
    ],
  },
  {
    id: 'zuhr', bn: 'যোহর', gen: 'যোহরের', ar: 'الظهر', waqt: 'দুপুর', rakat: '৪ রাকাত ফরজ',
    parts: [
      { n: 4, kind: 'সুন্নত', tone: 'sunnah' },
      { n: 4, kind: 'ফরজ', tone: 'farz' },
      { n: 2, kind: 'সুন্নত', tone: 'sunnah' },
      { n: 2, kind: 'নফল', tone: 'nafl' },
    ],
  },
  {
    id: 'asr', bn: 'আসর', gen: 'আসরের', ar: 'العصر', waqt: 'বিকাল', rakat: '৪ রাকাত ফরজ',
    parts: [
      { n: 4, kind: 'সুন্নত', tone: 'sunnah' },
      { n: 4, kind: 'ফরজ', tone: 'farz' },
    ],
  },
  {
    id: 'maghrib', bn: 'মাগরিব', gen: 'মাগরিবের', ar: 'المغرب', waqt: 'সন্ধ্যা', rakat: '৩ রাকাত ফরজ',
    parts: [
      { n: 3, kind: 'ফরজ', tone: 'farz' },
      { n: 2, kind: 'সুন্নত', tone: 'sunnah' },
      { n: 2, kind: 'নফল', tone: 'nafl' },
    ],
  },
  {
    id: 'isha', bn: 'এশা', gen: 'এশার', ar: 'العشاء', waqt: 'রাত', rakat: '৪ রাকাত ফরজ',
    parts: [
      { n: 4, kind: 'সুন্নত', tone: 'sunnah' },
      { n: 4, kind: 'ফরজ', tone: 'farz' },
      { n: 2, kind: 'সুন্নত', tone: 'sunnah' },
      { n: 2, kind: 'নফল', tone: 'nafl' },
      { n: 3, kind: 'বিতর', tone: 'witr' },
      { n: 2, kind: 'নফল', tone: 'nafl' },
    ],
  },
];

// এক ওয়াক্তে সব মিলিয়ে কয় রাকাত
export function totalRakat(prayer) {
  return prayer.parts.reduce((s, p) => s + p.n, 0);
}

export const STATUSES = [
  { id: 'prayed', bn: 'পড়েছে', short: 'পড়েছে', fine: 0, tone: 'good' },
  { id: 'qaza', bn: 'কাজা পড়েছে', short: 'কাজা', fine: 50, tone: 'warn' },
  { id: 'missed', bn: 'পড়েনি', short: 'পড়েনি', fine: 100, tone: 'bad' },
];

export const STATUS_MAP = STATUSES.reduce((acc, s) => {
  acc[s.id] = s;
  return acc;
}, {});

export function fineOf(statusId) {
  return STATUS_MAP[statusId] ? STATUS_MAP[statusId].fine : 0;
}

// এক দিনে এক জনের মোট জরিমানা
export function dayTotal(dayRecordForPerson) {
  if (!dayRecordForPerson) return 0;
  return PRAYERS.reduce((sum, p) => sum + fineOf(dayRecordForPerson[p.id]), 0);
}

// এক দিনে এক জনের কয়টা নামাজে সিদ্ধান্ত দেওয়া হয়েছে
export function dayFilled(dayRecordForPerson) {
  if (!dayRecordForPerson) return 0;
  return PRAYERS.filter((p) => dayRecordForPerson[p.id]).length;
}

export function dayCounts(dayRecordForPerson) {
  const counts = { prayed: 0, qaza: 0, missed: 0 };
  if (!dayRecordForPerson) return counts;
  PRAYERS.forEach((p) => {
    const s = dayRecordForPerson[p.id];
    if (s && counts[s] !== undefined) counts[s] += 1;
  });
  return counts;
}

/* ---------- দিন পেরোলে না-লেখা ওয়াক্ত = পড়েনি ---------- */
//
// দিন শেষ হয়ে গেলে (রাত ১২টা পেরোলে) যে ওয়াক্ত লেখা হয়নি, সেটা "পড়েনি" ধরা
// হয় — জরিমানা, মাসের খাতা, সঙ্গীর দেখা, মাস শেষের হিসাব, সবখানে।
//
// এটা ডেটাবেসে লেখা হয় না, প্রতিবার হিসাবের সময় বানানো হয়। লিখে রাখলে দুই
// ফোনের মেলানোয় বিপদ ছিল: রাত ১১টা ৫৯-এ নেট ছাড়া "পড়েছে" দিলে, আর রাত ১২টার
// পরে সার্ভার "পড়েনি" লিখে ফেললে, পরের মেলানোয় সার্ভারের নতুনটাই টিকত — আসল
// "পড়েছে" হারিয়ে যেত। এভাবে সেই সুযোগই নেই, আর পরে যেকোনো সময় পড়েছে বা
// কাজা বদলে দেওয়া যায়।
//
// missedFrom — যেদিন থেকে নিয়মটা খাটে (nh_users.missed_from, 'YYYY-MM-DD')।
// না জানা থাকলে নিয়মটা খাটে না — ভুল করে জরিমানা বসানোর চেয়ে এটা নিরাপদ।
// তারিখগুলো 'YYYY-MM-DD', তাই লেখা হিসেবে তুলনা করলেই আগে-পরে বোঝা যায়।

export function isAutoMissed(rec, prayerId, dayKey, today, missedFrom) {
  return Boolean(missedFrom) && dayKey < today && dayKey >= missedFrom && !(rec && rec[prayerId]);
}

// যে দিন পেরিয়ে গেছে, তার না-লেখা ওয়াক্তগুলো "পড়েনি" বসানো কপি।
// কিছু বদলানোর না থাকলে যা ছিল তাই ফেরত দেয় (নতুন অবজেক্ট বানায় না)।
export function withAutoMissed(rec, dayKey, today, missedFrom) {
  if (!missedFrom || dayKey >= today || dayKey < missedFrom) return rec || null;
  let out = null;
  PRAYERS.forEach((p) => {
    if (!rec || !rec[p.id]) {
      if (!out) out = { ...(rec || {}) };
      out[p.id] = 'missed';
    }
  });
  return out || rec;
}

// এক মাসে একজনের মোট জরিমানা আর গোনা — একেবারে না-লেখা দিনগুলোও ধরে।
// days: { 'YYYY-MM-DD': { fajr: 'prayed', … } }
export function monthSummary(days, ym, today, missedFrom) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let fine = 0;
  const counts = { prayed: 0, qaza: 0, missed: 0 };
  for (let d = 1; d <= last; d += 1) {
    const key = ym + '-' + String(d).padStart(2, '0');
    const rec = withAutoMissed(days ? days[key] : null, key, today, missedFrom);
    if (!rec) continue;
    fine += dayTotal(rec);
    const c = dayCounts(rec);
    counts.prayed += c.prayed;
    counts.qaza += c.qaza;
    counts.missed += c.missed;
  }
  return { fine, counts };
}
