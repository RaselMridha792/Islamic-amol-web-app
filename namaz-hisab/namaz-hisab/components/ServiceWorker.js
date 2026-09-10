'use client';

import { useEffect } from 'react';

// সার্ভিস ওয়ার্কার চালু করি। এটা শুধু ফাইল জমা রাখে —
// হিসাব বা পয়েন্টের কোনো কিছু নয়, নিয়মটা public/sw.js এ লেখা।
//
// আর নতুন সংস্করণ এলে সেটা যেন সত্যিই ফোনে পৌঁছায়, সেটাও এখানে।
//
// হোম স্ক্রিনে অ্যাড করা অ্যাপ অনেক দিন খোলা পড়ে থাকে। ভেতরে ট্যাব বদলালে
// পুরো পাতা নতুন করে লোড হয় না — পুরনো JS-ই চলতে থাকে, আর নতুন যা যোগ
// করা হয়েছে সেটা চোখেই পড়ে না। তাই মাঝে মাঝে খোঁজ নিই, আর নতুন সংস্করণ
// দায়িত্ব নিলে একবার পাতাটা রিফ্রেশ করে দিই।

const EVERY = 30 * 60 * 1000; // আধা ঘণ্টা

export default function ServiceWorker() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined;

    // প্রথমবার বসানোর সময় controller থাকে না। তখনকার controllerchange টা
    // স্বাভাবিক — ওতে রিফ্রেশ করলে খামোখা একবার ঝাঁকুনি লাগে।
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    let reg = null;
    let timer = null;

    const onSwap = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };

    const check = () => {
      if (reg && !document.hidden) reg.update().catch(() => undefined);
    };

    navigator.serviceWorker.addEventListener('controllerchange', onSwap);
    document.addEventListener('visibilitychange', check);

    // পাতা বসার পর, যাতে প্রথম লোড ধীর না হয়
    const id = setTimeout(() => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((r) => {
          reg = r;
          timer = setInterval(check, EVERY);
        })
        .catch(() => {
          // না হলেও অ্যাপ আগের মতোই চলবে, শুধু অফলাইনে খুলবে না
        });
    }, 1200);

    return () => {
      clearTimeout(id);
      if (timer) clearInterval(timer);
      navigator.serviceWorker.removeEventListener('controllerchange', onSwap);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  return null;
}
