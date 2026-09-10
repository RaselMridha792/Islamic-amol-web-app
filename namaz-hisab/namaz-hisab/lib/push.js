import webpush from 'web-push';
import { db } from './db';

// পুশ নোটিফিকেশন পাঠানোর জায়গা। শুধু সার্ভারে চলে।

let ready = false;

export function pushReady() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
}

function setup() {
  if (ready) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:noreply@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  ready = true;
}

// একজনের সব ডিভাইসে পাঠাই।
// ব্রাউজার ৪০৪/৪১০ বললে ওই ঠিকানা আর নেই — মুছে দিই, নইলে সারি জমতে থাকে।
export async function sendToUser(userId, payload) {
  if (!pushReady()) return { sent: 0, gone: 0 };
  setup();
  const sql = db();
  const rows = await sql`select endpoint, p256dh, auth from nh_push where user_id = ${userId}`;
  const body = JSON.stringify(payload);

  let sent = 0;
  const dead = [];
  await Promise.all(
    rows.map(async (r) => {
      try {
        await webpush.sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          body
        );
        sent += 1;
      } catch (err) {
        if (err && (err.statusCode === 404 || err.statusCode === 410)) dead.push(r.endpoint);
      }
    })
  );

  if (dead.length) {
    await sql.query('delete from nh_push where endpoint = any($1::text[])', [dead]);
  }
  return { sent, gone: dead.length };
}
