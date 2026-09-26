# VPS-এ Docker দিয়ে চালানো

এই ফোল্ডারে VPS-এ পুরো অ্যাপ চালানোর সবকিছু। এখন অ্যাপ Vercel + Neon-এ যেমন চলছে তেমনই চলছে — এখানকার কিছুই সেটা বদলায় না। সরে আসার দিন নিচের ধাপগুলো মেনে চললেই হবে।

## কী কী আছে

| ফাইল | কাজ |
| --- | --- |
| `docker-compose.yml` | **app** (অ্যাপ), **db** (PostgreSQL 18), **cron** (নোটিফিকেশনের সময় দেখা), **backup** (রোজকার ব্যাকআপ), আর ইচ্ছা হলে **caddy** (HTTPS সহ বাইরের দরজা) |
| `Caddyfile` | সাথের caddy চালালে তার নিয়ম — সার্টিফিকেট নিজে থেকেই নেয় ও নবায়ন করে |
| `.env.example` | কোন কোন মান লাগে তার তালিকা |
| `.env` | **আসল মান বসানো, তৈরি করা আছে** (git-এ যায় না) — পুশের চাবি আর cron-এর গোপন শব্দ Vercel-এর মতোই, ডেটাবেসের পাসওয়ার্ড নতুন |
| `restore.sh` | ব্যাকআপ থেকে ডেটাবেস ফেরানো |
| `backup.sh` | হাতে ব্যাকআপ নেওয়া |
| `pull-from-neon.sh` | Neon থেকে এই মুহূর্তের ব্যাকআপ — সরে আসার দিনের জন্য |

অ্যাপের ছবি বানানোর `Dockerfile` আছে `namaz-hisab/namaz-hisab/`-এ। অ্যাপ নিজে বুঝে নেয় কোন ডেটাবেস: ঠিকানা `…neon.tech` হলে Neon-এর পথে, নইলে সাধারণ Postgres (`lib/db.js`)।

## ব্যাকআপ

`backups/` ফোল্ডারে (রিপোর বাইরে থাকে, git-এ যায় না — এতে ব্যবহারকারীদের তথ্য আছে):

- `2026-09-26_0529/neondb.dump` — Neon-এর পুরো ব্যাকআপ, PostgreSQL 18-এর `pg_dump` দিয়ে। নতুন Postgres-এ ফিরিয়ে ১৪টা টেবিলের প্রতিটার সারি গুনে Neon-এর সাথে মেলানো হয়েছে — সব হুবহু এক।
- `2026-09-26_0529/neondb.sql` — একই জিনিস সাধারণ লেখায়, খুলে পড়া যায়।
- `SHA256SUMS` — ফাইল ঠিক আছে কি না যাচাইয়ের জন্য।

## VPS-এ প্রথমবার

**VPS:** Ubuntu 22.04 বা 24.04, অন্তত ২ GB RAM (১ GB হলে swap চালু করতে হবে — ছবি বানাতে মেমরি লাগে), ২২/৮০/৪৪৩ পোর্ট খোলা।

```bash
# ১. Docker
curl -fsSL https://get.docker.com | sh

# ২. কোড
git clone https://github.com/RaselMridha792/Islamic-amol-web-app.git
cd Islamic-amol-web-app
```

```bash
# ৩. নিজের কম্পিউটার থেকে গোপন ফাইল আর ব্যাকআপ পাঠানো (রিপোর ফোল্ডার থেকে চালান)
scp deploy/.env  user@VPS_IP:~/Islamic-amol-web-app/deploy/.env
scp -r backups   user@VPS_IP:~/Islamic-amol-web-app/
```

```bash
# ৪. VPS-এ: ডেটাবেস চালু, ব্যাকআপ ফেরানো, তারপর সবকিছু
cd ~/Islamic-amol-web-app/deploy
docker compose up -d --build db
./restore.sh 2026-09-26_0529/neondb.dump
docker compose up -d --build

# ৫. ঠিক আছে কি না
docker compose ps
curl -s http://127.0.0.1:3000/api/auth/me     # {"cloud":true,"user":null}
```

## ডোমেইন আর HTTPS

অ্যাপ খোলে শুধু সার্ভারের ভেতরে, `127.0.0.1:APP_PORT`-এ (`.env`-এ, শুরুতে 3000)। বাইরে থেকে আনার দুই পথ:

**ক) VPS-এ আগে থেকেই অন্য সাইটের জন্য nginx/Caddy আছে** (৮০/৪৪৩ দখল করা) — সেখানেই একটা সাইট যোগ করুন। nginx হলে:

```nginx
server {
    server_name deen-together.hellonizam.com;
    client_max_body_size 2m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

তারপর `sudo certbot --nginx -d deen-together.hellonizam.com`। আগে থেকে Caddy থাকলে তার Caddyfile-এ `deen-together.hellonizam.com { reverse_proxy 127.0.0.1:3000 }`।

**খ) VPS-এ আর কোনো ওয়েব সার্ভার নেই** — `.env`-এ `COMPOSE_PROFILES=caddy` দিয়ে `docker compose up -d`; সাথের Caddy নিজেই ৮০/৪৪৩ নিয়ে HTTPS সামলাবে।

HTTPS ছাড়া চলবে না: লগইনের কুকি শুধু HTTPS-এ থাকে, আর নোটিফিকেশন ও অফলাইন (service worker) HTTPS ছাড়া চলে না। ডোমেইনের DNS তখনো Vercel-এর দিকে থাকলে সার্টিফিকেট পাওয়া যাবে না — সেটা স্বাভাবিক, সরে আসার দিন DNS বদলালেই পাবে।

## Vercel থেকে সরে আসার দিন

দুজনের কেউ অ্যাপ ব্যবহার করছে না এমন সময়ে (যেমন রাতে):

1. **শেষ মুহূর্তের ডেটা আনা** — Neon থেকে নতুন ব্যাকআপ নিয়ে VPS-এ বসানো:
   ```bash
   NEON_URL='(Vercel-এর DATABASE_URL)' ./pull-from-neon.sh
   ./restore.sh neon-<সময়>/neondb.dump
   ```
2. **DNS বদলানো** — `deen-together.hellonizam.com`-এর A রেকর্ড VPS-এর IP-তে (Vercel-এর CNAME সরিয়ে), তারপর উপরের মতো HTTPS সার্টিফিকেট।
3. **Vercel বন্ধ** — প্রজেক্ট থেকে ডোমেইন সরান, আর `vercel.json`-এর রাতের রিমাইন্ডার cron বন্ধ করুন। নইলে Vercel তখনো পুরনো Neon ডেটা দেখে রিমাইন্ডার পাঠাবে।
4. **GitHub Actions বন্ধ** — "নামাজের সময় মনে করিয়ে দেওয়া" workflow এখন আর লাগে না, VPS-এর cron প্রতি মিনিটে এটা করে (আগে ৫ মিনিটে):
   ```bash
   gh workflow disable "নামাজের সময় মনে করিয়ে দেওয়া"
   ```

ফোনে কিছুই করতে হবে না: ডোমেইন একই, আর লগইন (সেশন) ও নোটিফিকেশনের সংযোগ ডেটাবেসের সাথেই চলে এসেছে, পুশের চাবিও একই।

## রোজকার কাজ

```bash
docker compose ps                      # কে কেমন আছে
docker compose logs -f app             # অ্যাপের লগ
docker compose logs --tail 20 cron     # নোটিফিকেশনের ডাক — প্রতি মিনিটে 200 আসার কথা

git pull && docker compose up -d --build   # নতুন সংস্করণ বসানো

./backup.sh                            # এখনই একটা ব্যাকআপ
./restore.sh auto/deen-2026-10-01.dump # কোনো ব্যাকআপ থেকে ফেরানো
```

**রোজকার ব্যাকআপ** নিজে থেকেই হয় — রাত ৩টায় (ঢাকা) `backups/auto/`-এ, শেষ ১৪ দিনেরটা থাকে। কিন্তু VPS নষ্ট হলে তার ভেতরের ব্যাকআপও যাবে, তাই মাঝে মাঝে নিজের কম্পিউটারে নামিয়ে রাখুন:

```bash
scp -r user@VPS_IP:~/Islamic-amol-web-app/backups/auto ./backups/
```

> **সাবধান:** `docker compose down -v` ডেটাবেস সহ সব মুছে ফেলে। থামাতে শুধু `docker compose down` (`-v` ছাড়া)।

## Neon-এই থাকতে চাইলে

নিজের ডেটাবেসের বদলে Neon-ই রাখতে চাইলে `.env`-এ `DATABASE_URL`-এ Neon-এর ঠিকানা দিন। অ্যাপ তখন Neon-এ চলবে; `db` আর `backup` চলতে থাকলেও ক্ষতি নেই, তবে তখন `backup` ফাঁকা লোকাল ডেটাবেসের ব্যাকআপ নেবে — Neon-এর ব্যাকআপের জন্য `pull-from-neon.sh`।
