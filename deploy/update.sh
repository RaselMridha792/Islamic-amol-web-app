#!/bin/sh
# DeenTogether হালনাগাদ — VPS-এ, নতুন কোড আনার পর:
#
#   cd /opt/deen && git pull && ./deploy/update.sh
#
# যা করে, এই ক্রমে:
#   ১. ডেটাবেসের পুরো ব্যাকআপ → backups/pre-update-<সময়>.dump (শেষ ৫টা থাকে)
#   ২. নতুন কোড দিয়ে ছবি বানিয়ে চালু করা — --build ছাড়া হয় না (CLAUDE.md দেখুন)
#   ৩. অ্যাপ ঠিকমতো উঠেছে কি না, আর ডেটাবেসের নতুন টেবিল বসল কি না দেখা
#   ৪. এই প্রজেক্টেরই পুরনো, কাজে না লাগা ছবি সরানো
#
# যা কখনো করে না:
#   • ডেটাবেসের ভলিউমে হাত দেওয়া — কোথাও down -v বা volume prune নেই
#   • অন্য প্রজেক্টের কিছু মোছা — ছবি সরানোর সময় শুধু
#     com.docker.compose.project=deentogether লেবেলওয়ালা, কোনো কন্টেইনার
#     ব্যবহার করছে না এমন ছবি। postgres/alpine-এর মতো নামানো ছবিতে এই লেবেল
#     থাকে না, তাই সেগুলোও থাকে।
#   • build cache মোছা — সেটা সার্ভারের সব প্রজেক্টের একসাথে, আলাদা করা যায় না
set -e
cd "$(dirname "$0")"

PROJECT=deentogether
KEEP_BACKUPS=5
stamp=$(date -u +%Y-%m-%d_%H%M)

echo "== ১. ব্যাকআপ"
if docker compose exec -T db psql -U deen -d deen -Atc 'select 1' >/dev/null 2>&1; then
  docker compose exec -T db pg_dump -U deen -d deen \
    --format=custom --compress=9 --no-owner --no-privileges \
    --file="/backups/pre-update-$stamp.dump"
  echo "   রাখা হলো: backups/pre-update-$stamp.dump"
  # আগের হালনাগাদের ব্যাকআপ — শেষ কয়েকটা রাখি, রোজকার auto/ ব্যাকআপে হাত দিই না
  ls -1t ../backups/pre-update-*.dump 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
else
  # ডেটাবেস চালু না থাকলে ব্যাকআপ নেওয়া যায় না; আগে জানিয়ে থামি, আন্দাজে এগোই না
  echo "   ডেটাবেস সাড়া দিচ্ছে না — ব্যাকআপ ছাড়া হালনাগাদ করব না। দেখুন: docker compose logs --tail 30 db"
  exit 1
fi

echo "== ২. নতুন সংস্করণ বানানো ও চালু করা"
docker compose up -d --build

echo "== ৩. যাচাই"
health=""
for i in $(seq 1 60); do
  health=$(docker compose ps app --format '{{.Health}}' 2>/dev/null || true)
  [ "$health" = "healthy" ] && break
  sleep 2
done
if [ "$health" != "healthy" ]; then
  echo "   অ্যাপ দুই মিনিটেও ঠিক হলো না (অবস্থা: ${health:-অজানা})। পুরনো ছবি রেখে দিলাম।"
  docker compose logs --tail 30 app
  exit 1
fi
echo "   অ্যাপ চালু"

# লগইন ছাড়া /api/touch ডাকলে আগে ডেটাবেসের টেবিলগুলো বসানো হয় (ensureSchema),
# তারপর 401 আসে। 401 মানে ডেটাবেস আর নতুন টেবিল — দুটোই ঠিক। 503 মানে গোলমাল।
code=$(docker compose exec -T app wget -S -O /dev/null http://127.0.0.1:3000/api/touch 2>&1 \
  | sed -n 's/.*HTTP\/[0-9.]* \([0-9][0-9][0-9]\).*/\1/p' | tail -n 1)
if [ "$code" = "401" ]; then
  echo "   ডেটাবেস ঠিক আছে, নতুন টেবিল বসেছে"
else
  echo "   সাবধান: ডেটাবেস যাচাইয়ে উত্তর এল ${code:-কিছুই না} (401 আসার কথা)। দেখুন: docker compose logs --tail 30 app"
  echo "   ব্যাকআপ আছে: backups/pre-update-$stamp.dump"
  exit 1
fi

echo "== ৪. এই প্রজেক্টের পুরনো ছবি সরানো"
docker image prune -f --filter "label=com.docker.compose.project=$PROJECT"

echo "== শেষ"
docker compose ps --format 'table {{.Service}}\t{{.State}}\t{{.Status}}'
