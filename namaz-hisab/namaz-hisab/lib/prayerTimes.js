// নামাজের সময়ের হিসাব।
//
// হিসাবের নিয়ম: কারাচি (ফজর ও এশা ১৮°) আর হানাফি (আসর) — বাংলাদেশে এটাই
// প্রচলিত। aladhan.com এর সাথে মিলিয়ে দেখা হয়েছে, ঢাকার সময় হুবহু মেলে।

import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan';

// জায়গা না দিলে ঢাকা
export const DEFAULT_PLACE = { lat: 23.8103, lng: 90.4125, city: 'ঢাকা' };

// বাংলাদেশের বড় শহরগুলো, যাতে বেছে নেওয়া যায়
export const CITIES = [
  { city: 'ঢাকা', lat: 23.8103, lng: 90.4125 },
  { city: 'চট্টগ্রাম', lat: 22.3569, lng: 91.7832 },
  { city: 'সিলেট', lat: 24.8949, lng: 91.8687 },
  { city: 'রাজশাহী', lat: 24.3745, lng: 88.6042 },
  { city: 'খুলনা', lat: 22.8456, lng: 89.5403 },
  { city: 'বরিশাল', lat: 22.7010, lng: 90.3535 },
  { city: 'রংপুর', lat: 25.7439, lng: 89.2752 },
  { city: 'ময়মনসিংহ', lat: 24.7471, lng: 90.4203 },
  { city: 'কুমিল্লা', lat: 23.4607, lng: 91.1809 },
  { city: 'কক্সবাজার', lat: 21.4272, lng: 92.0058 },
];

function params() {
  const p = CalculationMethod.Karachi();
  p.madhab = Madhab.Hanafi;
  return p;
}

// এক দিনের পাঁচ ওয়াক্ত (আর সূর্যোদয়), Date হিসেবে
export function timesFor(lat, lng, date = new Date()) {
  const t = new PrayerTimes(new Coordinates(lat, lng), date, params());
  return {
    fajr: t.fajr,
    sunrise: t.sunrise,
    dhuhr: t.dhuhr,
    asr: t.asr,
    maghrib: t.maghrib,
    isha: t.isha,
  };
}

// নোটিফিকেশনের জন্য: কোন ওয়াক্ত, কী লেখা
export const SLOTS = [
  { id: 'fajr', bn: 'ফজর' },
  { id: 'dhuhr', bn: 'যোহর' },
  { id: 'asr', bn: 'আসর' },
  { id: 'maghrib', bn: 'মাগরিব' },
  { id: 'isha', bn: 'এশা' },
];

// ফজরের কত পরে কুরআন পড়ার কথা মনে করাব
export const QURAN_AFTER_FAJR_MIN = 25;

export function hhmm(d, tz = 'Asia/Dhaka') {
  return new Intl.DateTimeFormat('bn-BD', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(d);
}
