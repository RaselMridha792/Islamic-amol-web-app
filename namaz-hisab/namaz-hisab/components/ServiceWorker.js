'use client';

import { useEffect } from 'react';

// সার্ভিস ওয়ার্কার চালু করি। এটা শুধু ফাইল জমা রাখে —
// হিসাব বা পয়েন্টের কোনো কিছু নয়, নিয়মটা public/sw.js এ লেখা।
export default function ServiceWorker() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // পাতা বসার পর, যাতে প্রথম লোড ধীর না হয়
    const id = setTimeout(() => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // না হলেও অ্যাপ আগের মতোই চলবে, শুধু অফলাইনে খুলবে না
      });
    }, 1200);
    return () => clearTimeout(id);
  }, []);

  return null;
}
