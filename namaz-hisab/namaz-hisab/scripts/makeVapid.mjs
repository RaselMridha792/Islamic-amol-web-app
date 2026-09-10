// Push notification এর VAPID চাবি বানায়।
//   node scripts/makeVapid.mjs
// বেরোনো দুটো লাইন .env.local এ (আর Vercel এর Environment Variables এ) বসাতে হবে।

import webpush from 'web-push';

const k = webpush.generateVAPIDKeys();
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + k.publicKey);
console.log('VAPID_PRIVATE_KEY=' + k.privateKey);
