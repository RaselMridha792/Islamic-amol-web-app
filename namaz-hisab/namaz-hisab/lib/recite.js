// আয়াতের তিলাওয়াতের অডিও।
// প্রতিটি আয়াতের আলাদা mp3, নম্বরটা পুরো কুরআনের হিসাবে (১ থেকে ৬২৩৬)।
// কোনো ফাইল রিপোতে রাখা নেই — চাপ দিলে তখনই নামে।

import { globalAyah } from './quranMeta';

// এই তালিকার প্রতিটি কারীকে CDN-এ যাচাই করে দেখা হয়েছে (শুরু, মাঝ ও শেষের
// আয়াত ধরে)। যেগুলো পাওয়া যায়নি সেগুলো ইচ্ছে করেই বাদ।
export const QARIS = [
  { id: 'ar.alafasy', name: 'মিশারি রশিদ আলাফাসি' },
  { id: 'ar.husary', name: 'মাহমুদ খলিল আল-হুসারি' },
  { id: 'ar.husarymujawwad', name: 'আল-হুসারি (মুজাওয়াদ)' },
  { id: 'ar.minshawi', name: 'মুহাম্মাদ সিদ্দিক আল-মিনশাবি' },
  { id: 'ar.mahermuaiqly', name: 'মাহের আল-মুয়াইকলি' },
  { id: 'ar.shaatree', name: 'আবু বকর আশ-শাতরি' },
  { id: 'ar.hudhaify', name: 'আলি আল-হুযাইফি' },
  { id: 'ar.muhammadayyoub', name: 'মুহাম্মাদ আইয়ুব' },
  { id: 'ar.ahmedajamy', name: 'আহমাদ আল-আজমি' },
];

export const DEFAULT_QARI = QARIS[0].id;

const KEY_QARI = 'namaz-hisab:qari:v1';

export function loadQari() {
  if (typeof window === 'undefined') return DEFAULT_QARI;
  try {
    const v = window.localStorage.getItem(KEY_QARI);
    return QARIS.some((q) => q.id === v) ? v : DEFAULT_QARI;
  } catch (err) {
    return DEFAULT_QARI;
  }
}

export function saveQari(id) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY_QARI, id);
  } catch (err) {
    // জমা রাখা না গেলেও এই বসাটুকু চলবে
  }
}

export function qariName(id) {
  const q = QARIS.find((x) => x.id === id);
  return q ? q.name : id;
}

export function ayahAudioUrl(surah, ayah, qari = DEFAULT_QARI) {
  return audioUrlByNumber(globalAyah(surah, ayah), qari);
}

// দোয়ার আয়াতগুলো বিশ্বজোড়া নম্বরে জমা থাকে, তাই সরাসরি নম্বর দিয়েও লাগে
export function audioUrlByNumber(n, qari = DEFAULT_QARI) {
  return `https://cdn.islamic.network/quran/audio/128/${qari}/${n}.mp3`;
}
