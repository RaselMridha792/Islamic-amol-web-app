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

# `pg_isready` নয় — একটা সত্যিকারের কোয়েরি।
#
# নতুন সার্ভারে প্রথমবার ভলিউমটা খালি থাকে, আর Postgres তখন নিজের প্রথম
# গোছগাছ করে: সেই সময় সে একটা অস্থায়ী সকেটে চলে, বাইরেরটা তখনো নেই।
# pg_isready ওই অবস্থাতেও "প্রস্তুত" বলে দেয়, আর ঠিক পরের লাইনের pg_restore
# গিয়ে পায় —
#   connection to server on socket "/var/run/postgresql/.s.PGSQL.5432"
#   failed: No such file or directory
# — ২৬ সেপ্টেম্বর ২০২৬-এ VPS-এ প্রথম restore এভাবেই ব্যর্থ হয়েছিল, আর ব্যর্থ
# হয়েও স্ক্রিপ্টটা শেষ পর্যন্ত চলে গিয়ে খালি ডেটাবেসের উপর অ্যাপ তুলে দিয়েছিল।
#
# `select 1` ঠিক সেই প্রশ্নটাই করে যেটা pg_restore-এর দরকার: একজন ক্লায়েন্ট
# কি এখন সংযোগ করে কিছু চালাতে পারে? পারলে হ্যাঁ, না পারলে অপেক্ষা।
tries=0
until docker compose exec -T db psql -U deen -d deen -Atc 'select 1' >/dev/null 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -gt 120 ]; then
    echo "ডেটাবেস দুই মিনিটেও সাড়া দিল না। থামছি — কিছু মোছা হয়নি।"
    echo "দেখুন:  docker compose logs --tail 30 db"
    exit 1
  fi
  sleep 1
done

docker compose exec -T db pg_restore -U deen -d deen \
  --clean --if-exists --no-owner --no-privileges --exit-on-error "/backups/$file"

docker compose up -d
echo "ফেরানো হলো: backups/$file"
