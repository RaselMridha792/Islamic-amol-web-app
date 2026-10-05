// তাহাজ্জুদের হিসাব।
//
// আলাদা কোনো টেবিল নেই — প্রতিদিনের নামাজের খাতার (nh_days) সেই দিনের লেখাতেই
// একটা চিহ্ন: { fajr: 'prayed', …, tahajjud: true }। তাই নেট ছাড়া লেখা, দুই
// ফোনের মেলানো আর সঙ্গীর দেখা — নামাজের খাতার মতোই চলে।
//
// জরিমানা বা "দিন পেরোলে পড়েনি" এতে লাগে না: ওগুলো শুধু পাঁচ ওয়াক্ত (PRAYERS)
// ধরে গোনে, আর তাহাজ্জুদ নফল।
//
// তারিখ: যেদিন পড়লেন সেই তারিখ — রাত ১২টার পরে পড়লে সেই ভোরের তারিখ।

import { shiftDay } from './store';

export const TAHAJJUD_KEY = 'tahajjud';

export function prayedTahajjud(rec) {
  return Boolean(rec && rec[TAHAJJUD_KEY]);
}

// days: { 'YYYY-MM-DD': { …, tahajjud: true } }
export function tahajjudStats(days, today) {
  const marked = Object.keys(days || {})
    .filter((k) => k <= today && prayedTahajjud(days[k]))
    .sort();
  const month = today.slice(0, 7);

  // টানা কয় রাত: আজ পড়া হয়ে থাকলে আজ থেকে, নইলে গতকাল থেকে পেছনে গুনি —
  // আজকের রাত এখনো বাকি থাকতে পারে, তাই আজ না পড়া মানেই ধারা ভাঙেনি
  let streak = 0;
  let k = prayedTahajjud(days && days[today]) ? today : shiftDay(today, -1);
  while (days && prayedTahajjud(days[k])) {
    streak += 1;
    k = shiftDay(k, -1);
  }

  // সবচেয়ে লম্বা টানা
  let best = 0;
  let run = 0;
  let prev = null;
  marked.forEach((d) => {
    run = prev && shiftDay(prev, 1) === d ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  });

  return {
    total: marked.length,
    month: marked.filter((d) => d.startsWith(month)).length,
    streak,
    best,
  };
}
