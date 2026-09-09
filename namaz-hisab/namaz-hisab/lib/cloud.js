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

export function register(username, password) {
  return call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
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
