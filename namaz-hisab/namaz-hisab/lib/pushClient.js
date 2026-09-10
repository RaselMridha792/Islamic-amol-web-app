// ব্রাউজার থেকে পুশ নোটিফিকেশন চালু-বন্ধ করার কাজ।

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    Boolean(KEY)
  );
}

// VAPID এর চাবি base64url এ থাকে, PushManager চায় Uint8Array
function toBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function api(body) {
  const res = await fetch('/api/push', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'হলো না');
  return d;
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('এই ব্রাউজারে নোটিফিকেশন চলে না');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('অনুমতি দেওয়া হয়নি');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toBytes(KEY),
    });
  }
  await api({ action: 'subscribe', subscription: sub.toJSON() });
  return true;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) {
    await api({ action: 'unsubscribe', endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  return false;
}

export function testPush() {
  return api({ action: 'test' });
}
