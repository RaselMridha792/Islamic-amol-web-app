// অফলাইনে অ্যাপটা যেন খোলে, তার জন্য সার্ভিস ওয়ার্কার।
//
// সবচেয়ে জরুরি নিয়মটা এখানেই লেখা: **/api/ এর কিছু কখনো জমা রাখা হয় না।**
// নামাজের হিসাব, কুরআন কতটুকু পড়া হলো, কুইজের পয়েন্ট, সঙ্গীর অগ্রগতি — সবই
// ওখান দিয়ে আসে, আর ওগুলো সবসময় টাটকা লাগে। জমা থাকে শুধু সেসব ফাইল যেগুলো
// সবার জন্য এক আর বদলায় না।

const VERSION = 'v2';
const SHELL = 'deen-shell-' + VERSION;   // পাতা, JS, CSS
const QURAN = 'deen-quran-' + VERSION;   // কুরআনের লেখা

// প্রথমবারেই যেটুকু থাকলে অফলাইনে পাতা খোলে
const PRECACHE = ['/', '/quran', '/quiz', '/amol', '/dashboard', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

function isQuranText(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/quran/') &&
    url.pathname.endsWith('.json');
}

function isBuildAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/');
}

function isPage(req, url) {
  return req.mode === 'navigate' && url.origin === self.location.origin;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (err) {
    return;
  }

  // ---- যা কখনো জমা থাকবে না ----
  // ব্যক্তিগত ও সবসময় বদলায় এমন সব কিছু। এখানে হাত না দিলে ব্রাউজার
  // স্বাভাবিক নিয়মেই সার্ভারে যাবে, আর হিসাব সবসময় আসল থাকবে।
  if (url.pathname.startsWith('/api/')) return;

  // ---- কুরআনের লেখা ও বিল্ডের ফাইল: একবার নামলে ওখান থেকেই ----
  if (isQuranText(url) || isBuildAsset(url)) {
    const box = isQuranText(url) ? QURAN : SHELL;
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(box).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // ---- পাতা: আগে সার্ভার, না পেলে জমানোটা ----
  // এভাবে অ্যাপের নতুন সংস্করণ সাথে সাথেই পাওয়া যায়, আর নেট না থাকলেও পাতা খোলে।
  if (isPage(req, url)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/')))
    );
  }
});


/* ---------- পুশ নোটিফিকেশন ---------- */

self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch (err) {
    data = { body: e.data ? e.data.text() : '' };
  }
  const title = data.title || 'একসাথে দ্বীনের পথে';
  e.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      lang: 'bn',
      tag: data.tag || 'deen',
      data: { url: data.url || '/' },
    })
  );
});

// নোটিফিকেশনে চাপ দিলে অ্যাপ খুলি। খোলা থাকলে সেই ট্যাবেই নিয়ে যাই,
// নইলে নতুন করে খুলি।
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
