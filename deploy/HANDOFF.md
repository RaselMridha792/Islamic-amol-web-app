# Handoff: host DeenTogether on the VPS

For the Claude session that manages the owner's VPS (it already hosts two other sites). Everything below was prepared and rehearsed on the owner's PC with Docker Desktop; your job is to fit it onto the VPS without disturbing the existing sites, verify it, and switch traffic only when the owner says so.

## What it is

- **App:** Next.js 15 (Node 22), in `namaz-hisab/namaz-hisab/`. A couple's prayer/Quran tracker, Bangla UI, PWA with web push.
- **Live now:** Vercel + Neon Postgres at `https://deen-together.hellonizam.com` (also `deen-together-rho.vercel.app`). **Keep it running** until cutover.
- **Target:** the Docker stack in `deploy/` — `app` (built from `namaz-hisab/namaz-hisab/Dockerfile`), `db` (postgres:18-alpine), `cron` (calls `/api/cron/prayer` every minute and `/api/cron/remind` once a day at 15:00 UTC), `backup` (daily `pg_dump` at 21:00 UTC → `backups/auto/`, keeps 14), and an optional `caddy` behind the compose profile `caddy`.
- **Database layer:** `lib/db.js` picks the driver from `DATABASE_URL` — `*.neon.tech` → Neon HTTP driver, anything else → `pg`. Tables are created/migrated automatically on the first request (`ensureSchema`); there is no migration step.
- Read `deploy/README.md` (Bangla) for the full procedure; this file is the checklist and the things that matter.

## Not in git — take these from the owner's PC

The repo is **public**. Never commit, print, or paste the contents of these.

| What | Where on the owner's PC |
| --- | --- |
| Filled-in env for the stack (VAPID keys and `CRON_SECRET` identical to production, fresh `POSTGRES_PASSWORD`, `COMPOSE_PROFILES=` empty, `APP_PORT=3000`, `DOMAIN=deen-together.hellonizam.com`) | `F:\Islamic-amol-web-app\deploy\.env` |
| Verified full backup of Neon (pg_dump 18, custom format; restore tested, all 14 tables' row counts matched Neon) | `F:\Islamic-amol-web-app\backups\2026-09-26_0529\neondb.dump` (+ `neondb.sql`, `SHA256SUMS`) |
| Neon connection string, only needed for a fresh pull at cutover (`DATABASE_URL`) | `F:\Islamic-amol-web-app\namaz-hisab\namaz-hisab\.env.local` |

Copy the first two to the VPS (`deploy/.env` and `backups/…`) with scp, preserving the layout: `backups/` sits next to `deploy/` at the repo root.

## Steps

1. **Look before touching.** On the VPS: what holds 80/443 (`sudo ss -ltnp`), which reverse proxy serves the other two sites (nginx / Caddy / Traefik, host or container), whether port 3000 is free, free RAM and disk, Docker + compose plugin present. Do not restart or reconfigure the other sites beyond adding one new site block.
2. **Code:** `git clone https://github.com/RaselMridha792/Islamic-amol-web-app.git` (branch `main`) into a directory of your choosing.
3. **Env:** put the owner's `deploy/.env` in `deploy/`. Adjust only if needed:
   - `APP_PORT` — change if 3000 is taken (the app binds `127.0.0.1:APP_PORT` only).
   - `COMPOSE_PROFILES` — leave **empty** when an existing proxy owns 80/443 (the likely case). Set to `caddy` only if nothing else serves the web.
4. **Build and restore:**
   ```bash
   cd deploy
   docker compose up -d --build db
   ./restore.sh 2026-09-26_0529/neondb.dump --yes
   docker compose up -d --build
   ```
   The image build needs roughly 1.5 GB of memory. If the VPS is small, add swap first rather than letting the build fail midway.
5. **Proxy:** add a site for the domain in the existing proxy, forwarding to `http://127.0.0.1:APP_PORT` with `Host` and `X-Forwarded-Proto` set (an nginx block is in `deploy/README.md`). HTTPS is mandatory: the session cookie is `Secure` in production, and push notifications and the service worker need HTTPS. The certificate can only be issued after DNS points at the VPS (step 7).
6. **Verify on the VPS** (before any DNS change):
   ```bash
   docker compose ps                                  # app and db healthy
   curl -s http://127.0.0.1:3000/api/auth/me          # {"cloud":true,"user":null}
   curl -s http://127.0.0.1:3000/api/touch            # {"error":"লগইন করা নেই"} (401) — DB reachable, schema ok
   docker compose logs --tail 5 cron                  # "/api/cron/prayer -> 200" once a minute
   docker compose logs --tail 5 backup                # "backup চালু"
   docker compose exec -T db psql -U deen -d deen -Atc "select count(*) from nh_users"   # 2
   ```
   A 503 from the cron call means the VAPID keys are missing from `.env`; 401 means `CRON_SECRET` differs between `app` and `cron`.

## Cutover — only with the owner's go-ahead

Each step here is outward-facing; confirm with the owner first.

1. **Fresh data** at a quiet time: `NEON_URL='<DATABASE_URL from .env.local>' ./pull-from-neon.sh`, then `./restore.sh neon-<timestamp>/neondb.dump --yes`. Anything written to Neon after this point is not carried over.
2. **DNS:** point `deen-together.hellonizam.com` (A record) to the VPS, replacing the Vercel CNAME; then issue the certificate.
3. **Stop the old schedulers**, or both hosts will send notifications from diverging databases:
   - Vercel: remove the domain from the project and disable the cron in `namaz-hisab/namaz-hisab/vercel.json` (or pause the project).
   - GitHub Actions: `gh workflow disable "নামাজের সময় মনে করিয়ে দেওয়া"` (repo `RaselMridha792/Islamic-amol-web-app`).
4. **Check from a phone:** the site opens over HTTPS, the owner is still logged in (sessions came with the database), and a test notification arrives — Settings → notifications toggle sends a test push (`POST /api/push` with `{"action":"test"}`).

Phones need nothing: same domain, same VAPID keys, and the push subscriptions and sessions are in the restored database.

**Rollback:** point DNS back to Vercel and re-enable its cron and the workflow. Neon still holds everything up to the cutover pull; data written on the VPS after cutover would have to be dumped from the VPS and restored into Neon by hand.

## Things that bite

- `/api/cron/remind` has **no dedupe** — exactly one scheduler may call it. The `cron` service guards its own once-a-day call; the old Vercel cron must be off after cutover. `/api/cron/prayer` is deduplicated in the database (`nh_notified`), so an overlap there only wastes calls.
- **Never change the VAPID keys** — every existing push subscription is bound to the public key.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is compiled into the browser bundle at **build** time (passed as a build arg from `.env`); after changing it you must rebuild the image, not just restart.
- `docker compose down -v` **deletes the database volume**. Use `down` without `-v`.
- Postgres 18's image keeps data under `/var/lib/postgresql/18/docker`; the compose file mounts the whole `/var/lib/postgresql`. Don't "fix" it to `/var/lib/postgresql/data`.
- Backups under `backups/auto/` live on the same disk as the database; suggest to the owner that copies are pulled off the VPS now and then.
- Updating later: `git pull && docker compose up -d --build` in `deploy/`.

## Resource use

Measured locally: the app image is 348 MB, and the database is about 63 MB (mostly quiz questions). Runtime memory was not measured — check `docker stats` once it is up, alongside the two existing sites.
