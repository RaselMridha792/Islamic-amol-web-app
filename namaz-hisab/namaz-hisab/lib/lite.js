'use client';

// হালকা মোড।
//
// সব ফোন এক নয়। কম দামের ফোনে ঝাপসা করা (blur), ছায়া, নড়াচড়া আর ভারী
// আরবি ফন্ট — এগুলোই পাতাটা আটকে দেয়। এই মোডে সেগুলো বাদ যায়, হিসাব-কিতাব
// সব একইরকম থাকে, শুধু সাজটা সাদামাটা হয়।
//
// তিনটে অবস্থা: 'auto' (ফোন দেখে নিজেই ঠিক করে), 'on', 'off'।

const KEY = 'namaz-hisab:lite:v1';

export function guessLite() {
  if (typeof navigator === 'undefined') return false;
  const mem = navigator.deviceMemory;              // গিগাবাইট, ক্রোমে পাওয়া যায়
  const cores = navigator.hardwareConcurrency;
  const net = navigator.connection;
  if (typeof mem === 'number' && mem <= 2) return true;
  if (typeof mem === 'number' && mem <= 4 && typeof cores === 'number' && cores <= 4) return true;
  if (typeof cores === 'number' && cores <= 2) return true;
  if (net && (net.saveData || /(^|-)2g$/.test(net.effectiveType || ''))) return true;
  return false;
}

export function loadLiteChoice() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'on' || v === 'off' ? v : 'auto';
  } catch (err) {
    return 'auto';
  }
}

export function saveLiteChoice(v) {
  try {
    if (v === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, v);
  } catch (err) {
    // জমা না রাখতে পারলেও এই বারের জন্য কাজ করবে
  }
  applyLite(v);
}

export function liteOn(choice) {
  const c = choice || loadLiteChoice();
  return c === 'on' ? true : c === 'off' ? false : guessLite();
}

export function applyLite(choice) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('lite', liteOn(choice));
}
