# DeenTogether — read this before you change anything

Written for the Claude session that develops this app. It stopped living on
Vercel on 26 Sep 2026 and now runs in Docker on the owner's VPS, beside two
other production sites. Most of what follows exists because of that move, and
a change made as if the app were still on Vercel will either not reach
production or will take something else down with it.

`deploy/HANDOFF.md` is how it got there. `deploy/README.md` (Bangla) is the
full procedure. This is what to know while working on the app itself.

---

## Where it actually runs

```
                        https://deen.raselmridha.com
                                    │
              ┌─────────────────────┴──────────────────────┐
              │  the finance app's nginx  —  sfm-nginx-1    │   80 / 443
              │  its conf.d: /opt/sfm/deploy/nginx/conf.d/  │
              └─────────┬───────────────────────┬──────────┘
                        │   hellonizam-edge     │
          ┌─────────────┴─────────┐   ┌─────────┴──────────┐
          │ deentogether-app-1    │   │ the HR portal      │
          │        :3000          │   │ hrm-web-1 / api    │
          └─────────┬─────────────┘   └────────────────────┘
                    │  deentogether_default  (private)
       ┌────────────┴────────────┬──────────────┬──────────────┐
       │ deentogether-db-1       │ …-cron-1     │ …-backup-1   │
       │ postgres:18, own volume │              │              │
       └─────────────────────────┴──────────────┴──────────────┘
```

The stack is at **`/opt/deen`** on the VPS; `deploy/` is where compose runs.
**Three sites share that machine and one front door.** This app owns none of
them.

---

## The database is not Neon any more

`lib/db.js` still chooses by `DATABASE_URL`: a `*.neon.tech` address takes
the Neon HTTP driver, anything else goes through `pg`. **In production it is
now `pg`, against `postgres:18-alpine` in a container.**

So when you write a query, it runs on real Postgres. Anything that only
worked because of a Neon driver quirk will now surface. The same ten queries
were run against both when the driver was added, but new ones are yours to
check.

**There is still no migration step.** `ensureSchema()` creates and alters
tables on the first request after a deploy. That means a schema change:

- runs against a **live database with real rows**, not an empty one;
- runs **once, on whichever request arrives first**, so it must be safe to
  attempt concurrently and safe to attempt again;
- must be **additive** — a `DROP` or a rename in `ensureSchema` is a data
  loss that ships itself.

`nh_users` holds **two** people. That is the whole user base, and it is the
owner and his wife. Read that as: no change here is too small to be about a
real person's data, and there is nobody to absorb a mistake.

---

## How a change reaches production

**A push deploys nothing.** There is no CI for this app and nothing watches
the repository — the owner chose to keep it manual for now. Somebody runs
this on the VPS:

```bash
cd /opt/deen && git pull && ./deploy/update.sh
```

`update.sh` takes a `pg_dump` first (`backups/pre-update-*.dump`, last 5 kept)
and refuses to go on without one, runs `docker compose up -d --build`, waits
for the app to be healthy, checks that `ensureSchema` went through (an
unauthenticated `/api/touch` must answer 401, not 503), and only then removes
images carrying `com.docker.compose.project=deentogether` that no container
uses. It never touches volumes and never prunes build cache — that cache is
shared by every site on the machine and cannot be split by project. On the
VPS's containerd image store a rebuilt image replaces the old one outright,
so that last step is usually a no-op; it is there for the classic store.

The bare form still works and is what `update.sh` runs in the middle:

```bash
cd /opt/deen && git pull && cd deploy && docker compose up -d --build
```

Two things about that command are load-bearing:

- **`--build` is not optional.** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is a
  `NEXT_PUBLIC_` variable, which Next replaces **at build time** — in server
  routes as well as in the browser bundle. Restarting a container with a new
  `.env` changes nothing. This cost a debugging session on 26 Sep: the cron
  answered 503 with the keys plainly present in `.env`, because the image had
  been built before they were filled in.
- **`restore.sh` ends with `docker compose up -d`, without `--build`** — so
  restoring a backup leaves whatever image was already there, and also
  **restarts services somebody had deliberately stopped**.

**Never `docker compose down -v`.** The `-v` deletes the database volume.
`down` on its own is safe.

---

## Things that will bite

- **The VAPID keys must never change.** Every push subscription a browser
  ever made is bound to the public key. Changing it silently breaks
  notifications for everyone, and the only symptom is that nothing arrives.
- **`/api/cron/remind` has no dedupe.** Exactly one scheduler may call it.
  The `cron` container is now the only one — the GitHub Actions workflow was
  disabled on 26 Sep and the Vercel cron with it. If you ever add a second
  caller, add the dedupe first.
- **`/api/cron/prayer` is deduped per database** (`nh_notified`), which does
  **not** help across two databases. Two hosts pointed at two copies means
  two notifications, and that happened during the move.
- **The domain changed**, from `deen-together.hellonizam.com` to
  `deen.raselmridha.com`. The app survived that without a code change, and
  that was checked rather than hoped: no file under `app/`, `lib/`,
  `components/` or `public/` names a host, and `manifest.json` starts at
  `"/"`. **Keep it that way** — the first absolute URL somebody writes is the
  one that has to be found again on the next move. What the change did cost:
  a session cookie and a push subscription each belong to an ORIGIN, so both
  people had to sign in again and turn notifications on again, and the rows
  in `nh_push` made under the old origin had to go.
- **An unwritten prayer on a past day counts as missed, but is never stored.**
  `withAutoMissed` in `lib/prayers.js` fills it in at read time — in the prayer
  page, the month calendar, the dashboard and the monthly settlement alike. Do
  not "simplify" this into a job that writes `missed` rows: `nh_days` syncs a
  whole day at a time, newest wins, so a server-written `missed` would silently
  overwrite a `prayed` that a phone tapped offline just before midnight. The
  rule starts at `nh_users.missed_from` (the day the column arrived, for the
  two existing people), so past months did not change when it shipped.
- **`gate.user.id` is a number.** `bigint` columns come back from Postgres as
  strings; `userFromToken` converts the id so that `Number(row.id) === me`
  means something. Until 26 Sep 2026 it did not, and three comparisons were
  silently false: the settlement never found the pair, a seen drawing was never
  marked seen, and a user could join their own pairing code. Other ids you read
  from a row are still strings — wrap them in `Number()` before comparing.
- **Postgres 18 keeps its data under `/var/lib/postgresql/18/docker`** and the
  compose file mounts the whole `/var/lib/postgresql`. Do not "fix" it to
  `/var/lib/postgresql/data`.

---

## The front door is not yours

`deploy/nginx/deen-together.conf` lives in this repository and is **copied**
into the finance app's nginx at `/opt/sfm/deploy/nginx/conf.d/`. Edit it
here; install it there.

If you change it, the safe sequence is:

```bash
cp /opt/deen/deploy/nginx/deen-together.conf /opt/sfm/deploy/nginx/conf.d/
docker exec sfm-nginx-1 nginx -t        # STOP if this fails
docker exec sfm-nginx-1 nginx -s reload
curl -s -o /dev/null -w '%{http_code}\n' https://hrm.hellonizam.com/login
```

`nginx -t` before every reload, and the HR portal checked after, because that
nginx serves **three** sites. A bad config there is an outage for two
applications that have nothing to do with this one.

Two rules inside that file exist for the same reason and are not style:

- **`resolver` stays inside the `server` block.** The HR portal's config in
  the same `conf.d` declares one at http level, and nginx refuses to start on
  a duplicate.
- **Any `limit_req_zone` you add needs a `deen_` prefix.** Zone names are
  global to the http block and `hrm_*` is taken.

Do not enable the `caddy` profile and do not publish a host port other than
the loopback one that is already there. 80 and 443 are not available.

---

## Secrets

`deploy/.env` is **not in git** and must never be. It holds the VAPID private
key, `CRON_SECRET` and the database password. It exists in two places: the
owner's PC at `F:\Islamic-amol-web-app\deploy\.env`, and `/opt/deen/deploy/.env`
on the VPS.

If you need to know whether a value is set, print the **names and lengths**,
never the values:

```bash
awk -F= '/^[A-Z_]+=/{printf "%-30s %s\n", $1, (length($2)?length($2)" chars":"EMPTY")}' .env
```

`DATABASE_URL` in that file is **deliberately empty** — empty means the
compose default, which is the local `db` container. A value there sends the
app at whatever it names, and on 26 Sep the wrong file was pasted onto the
server and pointed it at production Neon. Compose refused to start for an
unrelated missing variable, which is the only reason it was noticed.

---

## Backups

The `backup` container takes a `pg_dump` daily at **21:00 UTC** into
`backups/auto/`, keeps the last 14, and writes a line to its log either way.

```bash
docker compose logs --tail 5 backup
./backup.sh                                   # one now, by hand
./restore.sh auto/deen-2026-10-01.dump        # put one back
```

They sit on the same disk as the database, so they survive a mistake but not
the machine. Copies pulled off the VPS now and then are the owner's to do.

`pull-from-neon.sh` still works and is read-only against Neon, if a copy of
the pre-move data is ever wanted. Neon still holds everything up to
26 Sep 2026, 12:50 UTC.

---

## Running it here

```bash
docker network create hellonizam-edge     # once; only this machine needs it
cd deploy
docker compose up -d --build db
./restore.sh <some>/neondb.dump --yes
docker compose up -d --build
curl -s http://127.0.0.1:3000/api/auth/me     # {"cloud":true,"user":null}
```

The network is declared `external` because on the VPS it belongs to no stack.
Locally you create it once and forget it.

**Check a change against a restored copy of the real database, not an empty
one.** The row counts that matter are small and lopsided — 2 users, 23,795
quiz questions — and a query that is fine on an empty table is not evidence.

---

## Where the old world went

- **Vercel**: the project still exists and answers at
  `deen-together-rho.vercel.app`, but the custom domain was detached, so
  `deen-together.hellonizam.com` returns `DEPLOYMENT_NOT_FOUND`. It is not a
  rollback target any more.
- **GitHub Actions**: `prayer-reminder.yml` is `disabled_manually`.
- **Neon**: still there, still holding the pre-move data, and no longer
  written to by anything.

If any of that changes, this file is wrong and should be corrected rather
than worked around.
