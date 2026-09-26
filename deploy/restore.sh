#!/bin/sh
# ব্যাকআপ থেকে ডেটাবেস ফেরানো।
#   ./restore.sh 2026-09-26_0529/neondb.dump
#   ./restore.sh auto/deen-2026-10-01.dump
# ফাইলের পথ backups/ ফোল্ডারের ভেতর থেকে ধরে।
#
# সাবধান: বর্তমান ডেটাবেসের টেবিলগুলো মুছে ব্যাকআপেরগুলো বসে। ফেরানোর সময়
# অ্যাপ, cron আর backup থামিয়ে রাখা হয়, যাতে মাঝপথে কেউ কিছু না লেখে।
# প্রশ্ন ছাড়া চালাতে শেষে --yes দিন।
set -e
cd "$(dirname "$0")"

file="$1"
if [ -z "$file" ]; then
  echo "কোন ব্যাকআপ? যেমন: ./restore.sh 2026-09-26_0529/neondb.dump"
  echo "আছে:"
  (cd ../backups 2>/dev/null && find . -name '*.dump' | sed 's#^\./#  #' | sort)
  exit 1
fi
if [ ! -f "../backups/$file" ]; then
  echo "পাওয়া গেল না: backups/$file"
  exit 1
fi

if [ "$2" != "--yes" ]; then
  printf "বর্তমান ডেটা মুছে backups/%s বসানো হবে। চালিয়ে যেতে yes লিখুন: " "$file"
  read -r answer
  [ "$answer" = "yes" ] || { echo "বাতিল।"; exit 1; }
fi

docker compose up -d db
docker compose stop app cron backup 2>/dev/null || true
until docker compose exec -T db pg_isready -U deen -d deen -q; do sleep 1; done

docker compose exec -T db pg_restore -U deen -d deen \
  --clean --if-exists --no-owner --no-privileges --exit-on-error "/backups/$file"

docker compose up -d
echo "ফেরানো হলো: backups/$file"
