// কুরআনের পাতার "ভিডিও" ট্যাবে কী চলবে।
//
// ইউটিউবের প্লেলিস্টের লিংকটা পুরোটা এখানে বসিয়ে দিন, যেমন
//   https://www.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxx
// একটা ভিডিওর লিংক দিলেও চলে (https://youtu.be/xxxxxxxxxxx) — তখন শুধু ওই
// ভিডিওটাই থাকে। ভিডিওর লিংকে list= থাকলে (প্লেলিস্ট থেকে শেয়ার করলে থাকে)
// পুরো প্লেলিস্টটাই আসে। ফাঁকা থাকলে ট্যাবে লেখা থাকে "ভিডিও শিগগিরই আসছে"।
//
// দুটো জিনিস খেয়াল রাখবেন:
//   • প্লেলিস্ট Public বা Unlisted হতে হবে — Private হলে অন্য কেউ দেখতে পাবে না।
//   • যে ভিডিওর মালিক "Allow embedding" বন্ধ রেখেছেন, সেটা অ্যাপের ভেতরে চলবে না।

// কোরআন শিক্ষা কোর্স — Abu Tawha Muhammad Adnan, ২৫টি ক্লাস
export const PLAYLIST = 'https://www.youtube.com/playlist?list=PLx2FIOy9sn-5ffxB7L8simZ1vcnNmvur4';

// লিংক বা আইডি থেকে বের করি কী চালাতে হবে: { list } নাকি { video }
export function videoSource(input = PLAYLIST) {
  const s = String(input || '').trim();
  if (!s) return null;
  const list = s.match(/[?&]list=([A-Za-z0-9_-]+)/);
  if (list) return { list: list[1] };
  const video = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
  if (video) return { video: video[1] };
  // শুধু আইডি: প্লেলিস্টের আইডি PL/UU/OL দিয়ে শুরু আর লম্বা, ভিডিওর ঠিক ১১ অক্ষর
  if (/^(PL|UU|OL|FL)[A-Za-z0-9_-]{10,}$/.test(s)) return { list: s };
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return { video: s };
  return null;
}
