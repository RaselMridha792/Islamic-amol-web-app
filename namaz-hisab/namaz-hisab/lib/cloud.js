// ব্রাউজার থেকে নিজের সার্ভারে কথা বলার পাতলা স্তর।
// অ্যাপ আগে localStorage-এ লেখে, তারপর সুযোগ পেলে সার্ভারে মেলায়।

export const PROFILE_STAMP = '__profile';

async function call(url, options) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let body = null;
  try {
    body = await res.json();
  } catch (err) {
    body = null;
  }
  if (!res.ok) {
    const err = new Error((body && body.error) || 'অনুরোধটা শেষ হয়নি');
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body || {};
}

export function fetchMe() {
  return call('/api/auth/me');
}

export function login(username, password) {
  return call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function register(username, password, displayName) {
  return call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, displayName }),
  });
}

export function logout() {
  return call('/api/auth/logout', { method: 'POST' });
}

export function pullAll() {
  return call('/api/hisab');
}

export function pushChanges(payload) {
  return call('/api/hisab', { method: 'POST', body: JSON.stringify(payload) });
}

/* ---------- দুই কপি মেলানো ---------- */
// প্রতিটি দিনের নিজের সময়-ছাপ আছে; যেটা পরে বদলেছে সেটাই টেকে

export function mergeRecords(localRecords, localMeta, cloudDays) {
  const records = {};
  const meta = {};
  const toPush = [];
  const now = Date.now();
  const keys = new Set([...Object.keys(localRecords || {}), ...Object.keys(cloudDays || {})]);

  keys.forEach((k) => {
    const local = localRecords ? localRecords[k] : null;
    const cloud = cloudDays ? cloudDays[k] : null;
    const localAt = (localMeta && localMeta[k]) || 0;

    if (cloud && (!local || cloud.updatedAt >= localAt)) {
      records[k] = cloud.data || {};
      meta[k] = cloud.updatedAt;
    } else if (local) {
      const at = localAt || now;
      records[k] = local;
      meta[k] = at;
      toPush.push({ day: k, data: local, updatedAt: at });
    }
  });

  if (localMeta && localMeta[PROFILE_STAMP]) meta[PROFILE_STAMP] = localMeta[PROFILE_STAMP];

  return { records, meta, toPush };
}

// নাম-ছবি: যেটা পরে বদলেছে সেটাই রাখি
export function mergeProfile(localPeople, localAt, cloudProfile) {
  if (cloudProfile && cloudProfile.people && cloudProfile.updatedAt >= (localAt || 0)) {
    return { people: cloudProfile.people, at: cloudProfile.updatedAt, push: false };
  }
  return { people: localPeople, at: localAt || Date.now(), push: true };
}

/* ---------- জোড়া বাঁধা ---------- */

export const getPair = () => call('/api/pair');
export const makePairCode = () => call('/api/pair', { method: 'POST', body: JSON.stringify({ action: 'code' }) });
export const joinPair = (code) => call('/api/pair', { method: 'POST', body: JSON.stringify({ action: 'join', code }) });
export const unpair = () => call('/api/pair', { method: 'POST', body: JSON.stringify({ action: 'unpair' }) });

/* ---------- কুরআন ---------- */

export const getQuran = (surah) => call('/api/quran' + (surah ? '?surah=' + surah : ''));
export const getQuranJuz = (juz) => call('/api/quran?juz=' + juz);
export const markQuran = (surah, ayahs, read = true) =>
  call('/api/quran', { method: 'POST', body: JSON.stringify({ surah, ayahs, read }) });

/* ---------- কুইজ ---------- */

export const getQuiz = () => call('/api/quiz');
export const answerQuiz = (qid, chosen) =>
  call('/api/quiz', { method: 'POST', body: JSON.stringify({ qid, chosen }) });
export const moreQuiz = () =>
  call('/api/quiz', { method: 'POST', body: JSON.stringify({ more: true }) });

/* ---------- দোয়া ও আমলের টিক ---------- */

// day: 'YYYY-MM-DD' — না দিলে আজ
export const getTicks = (day) => call('/api/ticks' + (day ? '?day=' + day : ''));
export const getTickMonth = (month) => call('/api/ticks?month=' + month);
export const setTick = (kind, item, on, day) =>
  call('/api/ticks', { method: 'POST', body: JSON.stringify({ kind, item, on, day }) });

/* ---------- মাস শেষে জরিমানা মেটানো ---------- */

export const getSettle = () => call('/api/settle');
export const setSettle = (month, paid) =>
  call('/api/settle', { method: 'POST', body: JSON.stringify({ month, paid }) });

/* ---------- ড্যাশবোর্ড ---------- */

export const getDashboard = () => call('/api/dashboard');

/* ---------- স্পর্শ: সঙ্গীর স্ক্রিনে আঁকা, ফোন কাঁপানো ---------- */

const touchPost = (body) => call('/api/touch', { method: 'POST', body: JSON.stringify(body) });

export const getTouchStatus = () => call('/api/touch');
export const getTouch = (id, after = 0) => call(`/api/touch?id=${id}&after=${after}`);
export const getPendingTouch = () => call('/api/touch?pending=1');
export const startDraw = (aspect) => touchPost({ action: 'start', aspect });
export const sendDrawPart = (id, seq, data) => touchPost({ action: 'part', id, seq, data });
export const endDraw = (id) => touchPost({ action: 'end', id });
export const sendBuzz = () => touchPost({ action: 'buzz' });

// পাতা বন্ধ হয়ে যাওয়ার মুহূর্তে — fetch তখন মাঝপথে কেটে যায়, beacon যায়
export function endDrawBeacon(id) {
  if (typeof navigator === 'undefined' || !navigator.sendBeacon) return false;
  return navigator.sendBeacon('/api/touch', JSON.stringify({ action: 'end', id }));
}
