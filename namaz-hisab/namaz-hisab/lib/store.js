const KEY_RECORDS = 'namaz-hisab:records:v2';
const KEY_SOUND = 'namaz-hisab:sound:v1';

function read(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function write(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // স্টোরেজ ভরে গেলে চুপচাপ ছেড়ে দিই, অ্যাপ চলতে থাকবে
  }
}

export function loadRecords() {
  return read(KEY_RECORDS, {});
}

export function saveRecords(records) {
  write(KEY_RECORDS, records);
}

export function loadSoundOn() {
  const v = read(KEY_SOUND, true);
  return v !== false;
}

export function saveSoundOn(on) {
  write(KEY_SOUND, !!on);
}

/* ---------- তারিখ ---------- */

export function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function shiftDay(key, delta) {
  const d = fromKey(key);
  d.setDate(d.getDate() + delta);
  return toKey(d);
}

export function todayKey() {
  return toKey(new Date());
}

/* ---------- বাংলা লেখা ---------- */

export function bnNum(value) {
  const digits = '০১২৩৪৫৬৭৮৯';
  return String(value).replace(/[0-9]/g, (n) => digits[Number(n)]);
}

const BN_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
];

const BN_DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

export function formatDate(key) {
  const d = fromKey(key);
  return bnNum(d.getDate()) + ' ' + BN_MONTHS[d.getMonth()] + ', ' + bnNum(d.getFullYear());
}

export function formatDayName(key) {
  return BN_DAYS[fromKey(key).getDay()];
}

/* ---------- মাস ধরে হিসাব ---------- */
// এখানে ym মানে '2026-09' ধরনের মাস-চাবি

export function ymOf(key) {
  return key.slice(0, 7);
}

export function currentYm() {
  return ymOf(todayKey());
}

export function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export function monthKeysOf(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const keys = [];
  for (let i = 1; i <= last; i += 1) {
    keys.push(ym + '-' + String(i).padStart(2, '0'));
  }
  return keys;
}

export function formatYm(ym) {
  const [y, m] = ym.split('-').map(Number);
  return BN_MONTHS[m - 1] + ' ' + bnNum(y);
}

// মাসের ১ তারিখ কোন বারে পড়ল (০ = রবিবার), ক্যালেন্ডারের খালি ঘর গোনার জন্য
export function firstWeekdayOf(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).getDay();
}

export const BN_DAYS_SHORT = ['রবি', 'সোম', 'মঙ্গ', 'বুধ', 'বৃহ', 'শুক', 'শনি'];

/* ---------- ক্লাউডের সাথে মেলানোর তথ্য ---------- */

const KEY_META = 'namaz-hisab:meta:v2';

// প্রতিটি দিন কখন শেষ বদলেছে, মিলিসেকেন্ডে — কোন কপিটা নতুন তা এতেই বুঝি
export function loadMeta() {
  return read(KEY_META, {});
}

export function saveMeta(meta) {
  write(KEY_META, meta);
}

/* ---------- চট করে দেখানোর জন্য জমিয়ে রাখা ---------- */
// সঙ্গীর নাম-ছবি-হিসাব আর নিজের ছবি ব্রাউজারে রেখে দিই, যাতে রিফ্রেশ করলে
// সার্ভারের উত্তরের অপেক্ষায় পর্দা ফাঁকা না থাকে। এটা শুধু চোখে দেখানোর জন্য —
// আসল হিসাব সবসময় সার্ভার থেকেই আসে, আর এলেই এটা বদলে যায়।

const KEY_PARTNER = 'namaz-hisab:partner:v1';
const KEY_PHOTO = 'namaz-hisab:photo:v1';
const KEY_ME = 'namaz-hisab:me:v1';

// অ্যাপ খোলার পর্দায় দুজনের মুখ দেখাতে হলে নামটাও লাগে, শুধু ছবিতে হয় না
export function loadMeCache() {
  return read(KEY_ME, null);
}

export function saveMeCache(me) {
  write(KEY_ME, me || null);
}

export function loadPartnerCache() {
  return read(KEY_PARTNER, null);
}

export function savePartnerCache(partner) {
  write(KEY_PARTNER, partner || null);
}

export function loadPhotoCache() {
  return read(KEY_PHOTO, '') || '';
}

export function savePhotoCache(photo) {
  write(KEY_PHOTO, photo || '');
}

// লগআউট করলে সঙ্গীর তথ্য যেন এই ডিভাইসে পড়ে না থাকে
export function clearPersonCache() {
  write(KEY_PARTNER, null);
  write(KEY_PHOTO, '');
  write(KEY_ME, null);
}
