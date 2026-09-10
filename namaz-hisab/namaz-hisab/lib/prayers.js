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
