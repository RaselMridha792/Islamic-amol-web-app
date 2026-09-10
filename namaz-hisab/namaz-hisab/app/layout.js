import { Amiri, Hind_Siliguri, Noto_Serif_Bengali } from 'next/font/google';
import './globals.css';
import AuthProvider from '../components/AuthProvider';
import AppShell from '../components/AppShell';
import ServiceWorker from '../components/ServiceWorker';

// ফন্টগুলো নিজের সার্ভার থেকেই দিই।
//
// আগে google থেকে আসত — তাতে দুটো বাড়তি DNS + TLS হাত মেলানো লাগত, আর
// google-এর CSS টা render আটকে রাখত। ধীর মোবাইল নেটে ওটাই আধা সেকেন্ড খেয়ে
// নেয়। এখন ফাইলগুলো আমাদের নিজের ডোমেইন থেকেই যায়, ব্রাউজারে চিরকাল জমা থাকে।
//
// ওজনও কমানো — আগে হিন্দ সিলিগুড়ির চারটে ওজন, নোটো সেরিফের তিনটে আর আমিরির
// দুটো নামত, সব মিলিয়ে ৭০৮ কিলোবাইট। এখন ৩৩২। যেখানে ৫০০ বা ৭০০ চাওয়া
// হয়েছে ব্রাউজার কাছের ওজনটা দিয়েই চালিয়ে নেবে।

const hind = Hind_Siliguri({
  subsets: ['bengali', 'latin'],
  weight: ['400', '600'],
  display: 'swap',
  variable: '--font-body',
});

const serif = Noto_Serif_Bengali({
  subsets: ['bengali'],
  weight: ['600'],
  display: 'swap',
  variable: '--font-serif',
});

// আরবি ফন্টটা সবচেয়ে ভারী (~১৩৮ কিলোবাইট) আর সব পাতায় লাগে না, তাই
// preload বন্ধ — যে পাতায় আরবি অক্ষর আছে কেবল সেখানেই নামবে। হালকা মোডে
// একেবারেই নামে না, ফোনের নিজের আরবি ফন্ট দিয়ে চলে।
const amiri = Amiri({
  subsets: ['arabic'],
  weight: ['400'],
  display: 'swap',
  preload: false,
  variable: '--font-arabic',
});

// পাতা আঁকা শুরুর আগেই ঠিক হয়ে যেতে হয়, নইলে এক পলকের জন্য ভারী চেহারাটা
// দেখা যায় আর ফন্টটাও নেমে যায়। তাই এটুকু সরাসরি <head>-এ বসাই, React চালু
// হওয়ার অপেক্ষা না করে। হিসাবটা lib/lite.js এর guessLite এর মতোই।
const LITE_BOOT = `(function(){try{
var v=localStorage.getItem('namaz-hisab:lite:v1'),on;
if(v==='on'){on=true}else if(v==='off'){on=false}else{
var m=navigator.deviceMemory,c=navigator.hardwareConcurrency,n=navigator.connection;
on=(typeof m==='number'&&m<=2)||(typeof m==='number'&&m<=4&&typeof c==='number'&&c<=4)||(typeof c==='number'&&c<=2)||!!(n&&(n.saveData||/(^|-)2g$/.test(n.effectiveType||'')));}
if(on){document.documentElement.classList.add('lite')}
}catch(e){}})();`;

export const metadata = {
  title: 'DeenTogether — একসাথে দ্বীনের পথে',
  description: 'একসাথে পাঁচ ওয়াক্ত নামাজের হিসাব রাখার খাতা',
  manifest: '/manifest.json',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#10050D',
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="bn"
      suppressHydrationWarning
      className={`${hind.variable} ${serif.variable} ${amiri.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: LITE_BOOT }} />
      </head>
      <body>
        <ServiceWorker />
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
