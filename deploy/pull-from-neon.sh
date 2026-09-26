#!/bin/sh
# Neon থেকে এই মুহূর্তের পুরো ব্যাকআপ → backups/neon-<সময়>/neondb.dump
# Vercel থেকে VPS-এ সরে আসার দিন এটা চালিয়ে তারপর ./restore.sh — যাতে শেষ
# মুহূর্ত পর্যন্ত যা লেখা হয়েছে সবই আসে।
#
#   NEON_URL='postgresql://…neon.tech/neondb?sslmode=require' ./pull-from-neon.sh
#
# শুধু পড়ে, Neon-এ কিছু বদলায় না। Docker-এর postgres:18 ছবি দিয়ে চলে, তাই
# সার্ভারে আলাদা করে কিছু বসাতে হয় না।
set -e
cd "$(dirname "$0")"

if [ -z "$NEON_URL" ]; then
  echo "NEON_URL দিন — Vercel-এর DATABASE_URL-টাই"
  exit 1
fi

# pooler দিয়ে নয়, সরাসরি সংযোগে — pg_dump একটানা একটা সেশন চায়
direct=$(printf '%s' "$NEON_URL" | sed -e 's/-pooler\././' -e 's/[?&]channel_binding=[^&]*//')

dir="neon-$(date -u +%Y-%m-%d_%H%M)"
mkdir -p "../backups/$dir"
docker run --rm -e PGURL="$direct" -v "$(cd ../backups && pwd)/$dir:/out" postgres:18-alpine sh -c '
  set -e
  pg_dump "$PGURL" --format=custom --compress=9 --no-owner --no-privileges --file=/out/neondb.dump
  cd /out && sha256sum neondb.dump > SHA256SUMS
'
echo "Neon-এর ব্যাকআপ: backups/$dir/neondb.dump"
echo "এবার:  ./restore.sh $dir/neondb.dump"
