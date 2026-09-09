// আয়াতের তিলাওয়াতের অডিও।
// প্রতিটি আয়াতের আলাদা mp3 আছে, নম্বরটা পুরো কুরআনের হিসাবে (১ থেকে ৬২৩৬)।

import { globalAyah } from './quranMeta';

export const QARIS = [
  { id: 'ar.alafasy', name: 'মিশারি আলাফাসি' },
  { id: 'ar.husary', name: 'মাহমুদ খলিল আল-হুসারি' },
  { id: 'ar.minshawi', name: 'মুহাম্মাদ সিদ্দিক আল-মিনশাবি' },
];

export const DEFAULT_QARI = QARIS[0].id;

export function ayahAudioUrl(surah, ayah, qari = DEFAULT_QARI) {
  return `https://cdn.islamic.network/quran/audio/128/${qari}/${globalAyah(surah, ayah)}.mp3`;
}
