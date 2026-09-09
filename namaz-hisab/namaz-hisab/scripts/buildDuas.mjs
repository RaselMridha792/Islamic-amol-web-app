// দোয়ার তালিকা বানায় → lib/content/duas.js
//   node scripts/buildDuas.mjs
//
// কুরআনের দোয়াগুলোর আরবি হাতে লিখি না — যাচাই করা কুরআন ডেটা থেকেই টেনে আনি,
// তাই ওখানে ভুল হওয়ার সুযোগ নেই। শুধু হাদিসের অল্প কয়েকটা ছোট, অতি পরিচিত
// দোয়া হাতে লেখা, সেগুলো আলাদা করে চিহ্নিত।

import fs from 'node:fs';
import path from 'node:path';
import { toBanglaUccharon } from '../lib/uccharon.js';
import { globalAyah } from '../lib/quranMeta.js';

const ROOT = process.cwd();
const chapters = {};
function ch(n) {
  if (!chapters[n]) {
    chapters[n] = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/quran', n + '.json'), 'utf8'));
  }
  return chapters[n];
}

// surah:from-to → { ar, tr, bn }
function fromQuran(surah, from, to = from) {
  const c = ch(surah);
  const vs = c.verses.filter((v) => v.id >= from && v.id <= to);
  if (vs.length !== to - from + 1) throw new Error(`missing ayah ${surah}:${from}-${to}`);
  return {
    ar: vs.map((v) => v.text).join(' '),
    tr: vs.map((v) => toBanglaUccharon(v.text, surah, v.id)).join(' '),
    bn: vs.map((v) => v.translation).join(' '),
    ref: `সুরা ${c.transliteration} ${from}${to !== from ? '-' + to : ''}`,
    // তিলাওয়াত শোনার জন্য আয়াতগুলোর বিশ্বজোড়া নম্বর
    audio: vs.map((v) => globalAyah(surah, v.id)),
  };
}

// [id, শিরোনাম, কখন পড়বেন, সুরা, শুরু, শেষ]
const QURANIC = [
  ['fatiha', 'সুরা ফাতিহা', 'প্রতি রাকাতে, আর যেকোনো সময়', 1, 1, 7],
  ['ayatul-kursi', 'আয়াতুল কুরসি', 'প্রতি ফরজ নামাজের পর আর ঘুমানোর আগে', 2, 255, 255],
  ['dunya-akhirah', 'দুনিয়া ও আখিরাতের কল্যাণের দোয়া', 'যেকোনো সময়, বিশেষত তাওয়াফে', 2, 201, 201],
  ['sabr', 'ধৈর্যের দোয়া', 'কঠিন সময়ে', 2, 250, 250],
  ['la-yukallif', 'সামর্থ্যের বাইরে বোঝা না দেওয়ার দোয়া', 'সুরা বাকারার শেষ আয়াত', 2, 286, 286],
  ['qulub', 'অন্তর বাঁকা না করার দোয়া', 'হিদায়াতের উপর অটল থাকতে', 3, 8, 8],
  ['hasbunallah', 'হাসবুনাল্লাহ', 'ভয় বা দুশ্চিন্তার সময়', 3, 173, 173],
  ['zidni-ilma', 'জ্ঞান বৃদ্ধির দোয়া', 'পড়াশোনার আগে', 20, 114, 114],
  ['sharh-sadr', 'বুক প্রশস্ত করার দোয়া', 'কঠিন কাজ বা কথা বলার আগে', 20, 25, 28],
  ['yunus', 'দোয়া ইউনুস', 'বিপদ ও অস্থিরতায়', 21, 87, 87],
  ['ayyub', 'রোগমুক্তির দোয়া', 'অসুস্থতায়', 21, 83, 83],
  ['qurrata-ayun', 'স্ত্রী-সন্তানের জন্য দোয়া', 'পরিবারের কল্যাণ চেয়ে', 25, 74, 74],
  ['pita-mata', 'মা-বাবার জন্য দোয়া', 'প্রতিদিন', 17, 24, 24],
  ['ikhlas', 'সুরা ইখলাস', 'ঘুমানোর আগে তিনবার', 112, 1, 4],
  ['falaq', 'সুরা ফালাক', 'সকাল-সন্ধ্যা ও ঘুমানোর আগে', 113, 1, 5],
  ['nas', 'সুরা নাস', 'সকাল-সন্ধ্যা ও ঘুমানোর আগে', 114, 1, 6],
];

// হাতে লেখা — ইচ্ছে করেই শুধু ছোট ও অতি পরিচিতগুলো
const HADITH = [
  {
    id: 'bismillah-khabar',
    title: 'খাওয়ার আগে',
    when: 'খাবার শুরুর সময়',
    ar: 'بِسْمِ اللَّهِ',
    tr: 'Bismillah',
    bn: 'আল্লাহর নামে (শুরু করছি)।',
    ref: 'হাদিস',
  },
  {
    id: 'alhamdu-khabar',
    title: 'খাওয়ার পরে',
    when: 'খাবার শেষে',
    ar: 'الْحَمْدُ لِلَّهِ',
    tr: 'Alhamdulillah',
    bn: 'সকল প্রশংসা আল্লাহর।',
    ref: 'হাদিস',
  },
  {
    id: 'istighfar',
    title: 'ইস্তিগফার',
    when: 'দিনে যতবার পারা যায়',
    ar: 'أَسْتَغْفِرُ اللَّهَ',
    tr: 'Astaghfirullah',
    bn: 'আমি আল্লাহর কাছে ক্ষমা চাই।',
    ref: 'হাদিস',
  },
  {
    id: 'tasbih',
    title: 'তিন তাসবিহ',
    when: 'প্রতি নামাজের পর ৩৩ বার করে',
    ar: 'سُبْحَانَ اللَّهِ — الْحَمْدُ لِلَّهِ — اللَّهُ أَكْبَرُ',
    tr: 'Subhanallah — Alhamdulillah — Allahu Akbar',
    bn: 'আল্লাহ পবিত্র — সকল প্রশংসা আল্লাহর — আল্লাহ সবচেয়ে বড়।',
    ref: 'হাদিস',
  },
  {
    id: 'la-hawla',
    title: 'লা হাওলা ওয়ালা কুওয়াতা',
    when: 'কষ্ট বা অক্ষমতার সময়',
    ar: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
    tr: 'La hawla wa la quwwata illa billah',
    bn: 'আল্লাহর সাহায্য ছাড়া কোনো উপায় ও শক্তি নেই।',
    ref: 'হাদিস',
  },
  {
    id: 'durud',
    title: 'দরুদ',
    when: 'দিনে বারবার, বিশেষত শুক্রবারে',
    ar: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ',
    tr: 'Allahumma salli ala Muhammadin wa ala ali Muhammad',
    bn: 'হে আল্লাহ, মুহাম্মাদ ও তাঁর পরিবারের উপর রহমত বর্ষণ করুন।',
    ref: 'হাদিস',
  },
  {
    id: 'inna-lillah',
    title: 'বিপদের সময়',
    when: 'কোনো ক্ষতি বা মৃত্যুর সংবাদে',
    ar: 'إِنَّا لِلَّهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ',
    tr: 'Inna lillahi wa inna ilayhi rajiun',
    bn: 'নিশ্চয়ই আমরা আল্লাহর, আর তাঁরই কাছে ফিরে যাব।',
    ref: 'সুরা বাকারা ১৫৬',
  },
];

const list = [
  ...QURANIC.map(([id, title, when, s, from, to]) => {
    const q = fromQuran(s, from, to);
    return { id, title, when, kind: 'quran', ...q };
  }),
  ...HADITH.map((d) => ({ ...d, tr: toBanglaUccharon(d.ar), kind: 'hadith' })),
];

const out = `// এই ফাইলটা scripts/buildDuas.mjs দিয়ে বানানো — হাতে বদলাবেন না।
// কুরআনের দোয়াগুলোর আরবি, উচ্চারণ ও অনুবাদ যাচাই করা কুরআন ডেটা থেকে নেওয়া।
export const DUAS = ${JSON.stringify(list, null, 2)};

export default DUAS;
`;
fs.writeFileSync(path.join(ROOT, 'lib/content/duas.js'), out);
console.log('lib/content/duas.js লেখা হলো —', list.length, 'টি দোয়া');
console.log('  কুরআন থেকে:', list.filter((d) => d.kind === 'quran').length);
console.log('  হাদিস (হাতে লেখা):', list.filter((d) => d.kind === 'hadith').length);
