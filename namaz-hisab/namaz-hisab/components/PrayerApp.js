'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PrayerCard from './PrayerCard';
import MonthReport from './MonthReport';
import PageHead from './PageHead';
import ToastStack from './Toast';
import Avatar from './Avatar';
import { useAuth } from './AuthProvider';
import InstallButton from './InstallButton';
import Preloader from './Preloader';
import { CheckIcon, ChevronIcon, CloudIcon, MoonIcon } from './Icons';
import { PRAYERS, STATUS_MAP, dayTotal, dayFilled, isAutoMissed, withAutoMissed } from '../lib/prayers';
import { playSound, warmUpAudio } from '../lib/sound';
import { TAHAJJUD_KEY, prayedTahajjud } from '../lib/tahajjud';
import { getSettle, mergeRecords, pullAll, pushChanges, setSettle } from '../lib/cloud';
import {
  bnNum,
  formatDate,
  formatDayName,
  formatYm,
  loadMeta,
  loadMissedFrom,
  loadPartnerCache,
  loadPhotoCache,
  loadRecords,
  loadSoundOn,
  saveMeCache,
  saveMeta,
  saveMissedFrom,
  savePartnerCache,
  savePhotoCache,
  saveRecords,
  shiftDay,
  todayKey,
} from '../lib/store';

const EMPTY = {};
const PULL_EVERY = 60000;

export default function PrayerApp() {
  const { user } = useAuth();

  const [ready, setReady] = useState(false);
  const [records, setRecords] = useState({});
  const [partner, setPartner] = useState(null); // { name, days }
  const [photo, setPhoto] = useState('');
  const [dateKey, setDateKey] = useState(todayKey());
  const [soundOn, setSoundOn] = useState(true);
  const [sync, setSync] = useState('syncing');
  const [toasts, setToasts] = useState([]);
  // কোন দিন থেকে "দিন পেরোলে না-লেখা = পড়েনি" (সার্ভার বলে দেয়)
  const [missedFrom, setMissedFrom] = useState(null);
  // মাস শেষে জরিমানা মেটানোর হিসাব (সার্ভারে গোনা)
  const [settle, setSettleState] = useState(null);
  const [monthReq, setMonthReq] = useState(null);
  const monthRef = useRef(null);
  const timers = useRef([]);

  const recordsRef = useRef({});
  const metaRef = useRef({});
  const pendingRef = useRef(new Set());
  const pushTimer = useRef(null);
  const busyRef = useRef(false);

  const me = useMemo(
    () => ({ name: user ? user.name || user.username : 'আমি', photo }),
    [user, photo]
  );

  // লগইনের উত্তরে ছবি এলে সেটাই নিই, আর পরের বারের জন্য জমিয়ে রাখি
  useEffect(() => {
    if (!user) return;
    if (typeof user.photo === 'string') {
      setPhoto(user.photo);
      savePhotoCache(user.photo);
    }
    saveMeCache({ name: user.name || user.username, photo: user.photo || '' });
  }, [user]);

  const partnerPerson = useMemo(
    () => (partner ? { name: partner.name, photo: partner.photo || '' } : null),
    [partner]
  );

  const pushToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { ...toast, id }].slice(-2));
    timers.current.push(
      setTimeout(() => {
        setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      }, 2300)
    );
    timers.current.push(
      setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 2560)
    );
  }, []);

  /* ---------- সার্ভারের সাথে মেলানো ---------- */

  // জরিমানা মেটানোর হিসাব দুজনের খাতার উপর নির্ভর করে, তাই খাতা মেলার পরে আনি
  const loadSettle = useCallback(() => {
    getSettle()
      .then((d) => setSettleState(d && d.paired ? d : null))
      .catch(() => {});
  }, []);

  const flushPush = useCallback(async () => {
    if (pendingRef.current.size === 0) return;
    const keys = Array.from(pendingRef.current);
    pendingRef.current.clear();
    const days = keys.map((k) => ({
      day: k,
      data: recordsRef.current[k] || EMPTY,
      updatedAt: metaRef.current[k] || Date.now(),
    }));
    setSync('syncing');
    try {
      await pushChanges({ days });
      setSync('ok');
      loadSettle();
    } catch (err) {
      // পাঠানো না গেলে সারিতে ফিরিয়ে রাখি, পরের বার যাবে
      keys.forEach((k) => pendingRef.current.add(k));
      setSync('error');
    }
  }, [loadSettle]);

  const queueDay = useCallback(
    (key) => {
      pendingRef.current.add(key);
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(flushPush, 900);
    },
    [flushPush]
  );

  const fullSync = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setSync('syncing');
    try {
      const remote = await pullAll();
      const merged = mergeRecords(recordsRef.current, metaRef.current, remote.days || {});

      recordsRef.current = merged.records;
      metaRef.current = merged.meta;
      saveRecords(merged.records);
      saveMeta(merged.meta);
      setRecords(merged.records);
      setPartner(remote.partner || null);
      savePartnerCache(remote.partner || null);
      setMissedFrom(remote.missedFrom || null);
      saveMissedFrom(remote.missedFrom || null);

      if (merged.toPush.length) await pushChanges({ days: merged.toPush });
      setSync('ok');
      if (remote.partner) loadSettle();
      else setSettleState(null);
    } catch (err) {
      setSync('error');
    } finally {
      busyRef.current = false;
    }
  }, [loadSettle]);

  useEffect(() => {
    const r = loadRecords();
    recordsRef.current = r;
    metaRef.current = loadMeta();
    setRecords(r);
    // জমানো কপি দিয়ে সাথে সাথে দেখাই, তারপর সার্ভারের টাটকাটা এসে বসবে
    setPartner(loadPartnerCache());
    setMissedFrom(loadMissedFrom());
    setPhoto(loadPhotoCache());
    setSoundOn(loadSoundOn());
    setDateKey(todayKey());
    setReady(true);
    fullSync();

    const list = timers.current;
    return () => {
      list.forEach(clearTimeout);
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [fullSync]);

  // সঙ্গী অন্য ফোন থেকে লিখলে যেন দেখতে পাই
  useEffect(() => {
    const onFocus = () => fullSync();
    window.addEventListener('focus', onFocus);
    const iv = setInterval(fullSync, PULL_EVERY);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(iv);
    };
  }, [fullSync]);

  /* ---------- এই দিনের হিসাব ---------- */

  // যা লেখা আছে, আর দিন পেরিয়ে গেলে না-লেখাগুলো "পড়েনি" বসানো কপি (lib/prayers.js)
  const today = todayKey();
  const partnerFrom = partner ? partner.missedFrom || null : null;
  const stored = records[dateKey] || EMPTY;
  const storedTheirs = partner && partner.days ? partner.days[dateKey] || EMPTY : EMPTY;
  const mine = withAutoMissed(stored, dateKey, today, missedFrom) || EMPTY;
  const theirs = withAutoMissed(storedTheirs, dateKey, today, partnerFrom) || EMPTY;
  const isToday = dateKey === today;

  const myTotal = useMemo(() => dayTotal(mine), [mine]);
  const theirTotal = useMemo(() => dayTotal(theirs), [theirs]);
  const filled = dayFilled(stored);

  const handlePick = useCallback(
    (prayerId, statusId) => {
      warmUpAudio();
      const prayer = PRAYERS.find((p) => p.id === prayerId);
      const status = STATUS_MAP[statusId];

      const base = recordsRef.current[dateKey] || EMPTY;
      // নিজে থেকে বসা "পড়েনি"-তে আবার "পড়েনি" চাপলে সেটা লিখে রাখি, মুছি না
      const auto = isAutoMissed(base, prayerId, dateKey, todayKey(), missedFrom);
      const undo = !auto && base[prayerId] === statusId;
      const nextDay = { ...base };
      if (undo) delete nextDay[prayerId];
      else nextDay[prayerId] = statusId;

      const next = { ...recordsRef.current, [dateKey]: nextDay };
      const at = Date.now();
      recordsRef.current = next;
      metaRef.current = { ...metaRef.current, [dateKey]: at };
      saveRecords(next);
      saveMeta(metaRef.current);
      setRecords(next);
      queueDay(dateKey);

      if (undo) {
        playSound('clear', soundOn);
        const passed = isAutoMissed(nextDay, prayerId, dateKey, todayKey(), missedFrom);
        pushToast({
          tone: 'info',
          title: prayer.bn + ' আবার খালি',
          body: passed
            ? 'লেখা মুছে দেওয়া হলো — দিন পেরিয়ে গেছে, তাই পড়েনি ধরা হবে'
            : 'এই ওয়াক্তের হিসাব মুছে দেওয়া হলো',
        });
        return;
      }

      playSound(statusId, soundOn);
      if (statusId === 'prayed') {
        pushToast({ tone: 'good', title: prayer.bn + ' পড়েছেন', body: 'মাশাআল্লাহ', amount: '৳ ০' });
      } else if (statusId === 'qaza') {
        pushToast({
          tone: 'warn',
          title: prayer.bn + ' কাজা',
          body: 'অর্ধেক জরিমানা খাতায় উঠল',
          amount: '+ ৳ ' + bnNum(status.fine),
        });
      } else {
        pushToast({
          tone: 'bad',
          title: prayer.bn + ' পড়া হয়নি',
          body: 'পুরো জরিমানা খাতায় উঠল',
          amount: '+ ৳ ' + bnNum(status.fine),
        });
      }
    },
    [dateKey, missedFrom, pushToast, queueDay, soundOn]
  );

  // তাহাজ্জুদ — একই দিনের লেখাতেই একটা চিহ্ন (lib/tahajjud.js), জরিমানায় ঢোকে না
  const toggleTahajjud = useCallback(() => {
    warmUpAudio();
    const base = recordsRef.current[dateKey] || EMPTY;
    const nextDay = { ...base };
    const was = prayedTahajjud(base);
    if (was) delete nextDay[TAHAJJUD_KEY];
    else nextDay[TAHAJJUD_KEY] = true;
    const next = { ...recordsRef.current, [dateKey]: nextDay };
    recordsRef.current = next;
    metaRef.current = { ...metaRef.current, [dateKey]: Date.now() };
    saveRecords(next);
    saveMeta(metaRef.current);
    setRecords(next);
    queueDay(dateKey);
    playSound(was ? 'clear' : 'prayed', soundOn);
    pushToast(
      was
        ? { tone: 'info', title: 'তাহাজ্জুদ খালি', body: 'এই দিনের চিহ্ন তুলে নেওয়া হলো' }
        : { tone: 'good', title: 'তাহাজ্জুদ পড়েছেন', body: 'আলহামদুলিল্লাহ — আল্লাহ কবুল করুন' }
    );
  }, [dateKey, pushToast, queueDay, soundOn]);

  // আগের কোনো মাসের জরিমানা মেটানো হলো / বাতিল
  const handleSettle = useCallback(
    async (month, paid) => {
      try {
        const d = await setSettle(month, paid);
        setSettleState(d && d.paired ? d : null);
        playSound(paid ? 'prayed' : 'clear', soundOn);
        pushToast(
          paid
            ? { tone: 'good', title: formatYm(month) + ' মিটে গেল', body: 'পরিশোধিত লেখা হলো' }
            : { tone: 'info', title: formatYm(month) + ' আবার বাকি', body: 'পরিশোধ বাতিল করা হলো' }
        );
      } catch (err) {
        pushToast({ tone: 'bad', title: 'হলো না', body: err.message || 'আবার চেষ্টা করুন' });
      }
    },
    [pushToast, soundOn]
  );

  // কে কাকে দেবেন — নাম বসিয়ে
  const oweText = (payer, amount) => {
    if (!settle || !payer) return '';
    const from = payer === 'me' ? me.name : settle.partner.name;
    const to = payer === 'me' ? settle.partner.name : me.name;
    return `${from} ${to}-কে ৳${bnNum(amount)} দেবেন`;
  };

  function goDay(delta) {
    const next = shiftDay(dateKey, delta);
    if (delta > 0 && next > todayKey()) return;
    setDateKey(next);
    playSound('save', soundOn);
  }

  const syncLabel = { syncing: 'মেলানো হচ্ছে…', ok: 'সব মিলে আছে', error: 'মেলানো যায়নি' }[sync];

  if (!ready) return <Preloader />;

  return (
    <>
      <ToastStack toasts={toasts} />

      <main className="shell">
        <PageHead
          title="নামাজের খাতা"
          sub="পাঁচ ওয়াক্তের হিসাব"
          right={
            <button
              type="button"
              className={'icon-btn sync-' + sync}
              onClick={fullSync}
              aria-label={syncLabel}
              title={syncLabel}
            >
              <CloudIcon state={sync} />
            </button>
          }
        />

        <div className="datebar">
          <button type="button" className="nav" onClick={() => goDay(-1)} aria-label="আগের দিন">
            <ChevronIcon dir="left" />
          </button>
          <div className="center">
            <strong>{isToday ? 'আজ, ' + formatDayName(dateKey) : formatDayName(dateKey)}</strong>
            <span>{formatDate(dateKey)}</span>
          </div>
          <button
            type="button"
            className="nav"
            onClick={() => goDay(1)}
            disabled={isToday}
            aria-label="পরের দিন"
          >
            <ChevronIcon dir="right" />
          </button>
        </div>

        {!isToday ? (
          <button type="button" className="today-chip" onClick={() => setDateKey(todayKey())}>
            আজকের দিনে ফিরে যান
          </button>
        ) : null}

        <div className="duo" style={{ marginTop: 16 }}>
          <div className="duo-person">
            <Avatar person={me} />
            <div className="who">{me.name}</div>
            <div className={'amount' + (myTotal === 0 ? ' zero' : '')}>৳ {bnNum(myTotal)}</div>
          </div>
          {partner ? (
            <>
              <div className="duo-sep" />
              <div className="duo-person">
                <Avatar person={partnerPerson} />
                <div className="who">{partner.name}</div>
                <div className={'amount' + (theirTotal === 0 ? ' zero' : '')}>
                  ৳ {bnNum(theirTotal)}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="install-row">
          <InstallButton />
        </div>

        {settle && settle.due && settle.due.months.length ? (
          <button
            type="button"
            className="due-banner"
            onClick={() => {
              setMonthReq({ ym: settle.due.months[settle.due.months.length - 1], at: Date.now() });
              if (monthRef.current) monthRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <b>জরিমানা বাকি · {settle.due.months.map(formatYm).join(', ')}</b>
            <span>
              {settle.due.payer
                ? oweText(settle.due.payer, settle.due.amount)
                : 'দুদিকে সমান — দেখে নিয়ে মিটিয়ে দিন'}
              {' '}· দেখতে চাপুন
            </span>
          </button>
        ) : null}

        {!partner ? (
          <div className="empty-note" style={{ marginTop: 12 }}>
            সঙ্গীর সাথে জোড়া বাঁধেননি। সেটিংসে গিয়ে কোড দিয়ে জোড়া বাঁধলে একে অপরের হিসাব দেখতে
            পাবেন।
          </div>
        ) : null}

        <div className="cards">
          {PRAYERS.map((prayer) => (
            <PrayerCard
              key={prayer.id}
              prayer={prayer}
              me={me}
              partner={partnerPerson}
              mine={mine}
              theirs={theirs}
              mineAuto={isAutoMissed(stored, prayer.id, dateKey, today, missedFrom)}
              theirsAuto={Boolean(partner) && isAutoMissed(storedTheirs, prayer.id, dateKey, today, partnerFrom)}
              onPick={handlePick}
            />
          ))}
        </div>

        {/* তাহাজ্জুদ — পাঁচ ওয়াক্তের পরে, রাতের নফল */}
        <section className="card tj-card">
          <header className="card-head">
            <div className="waqt-badge">
              <MoonIcon />
            </div>
            <div className="card-title">
              <div className="name">তাহাজ্জুদ</div>
              <div className="sub">
                রাতের নফল · এ মাসে{' '}
                {bnNum(
                  Object.keys(records).filter((k) => k.slice(0, 7) === dateKey.slice(0, 7) && prayedTahajjud(records[k]))
                    .length
                )}{' '}
                রাত
              </div>
            </div>
            <div className="arabic">التهجد</div>
          </header>
          <div className="tj-card-row">
            <button
              type="button"
              className={'choice good' + (prayedTahajjud(stored) ? ' on' : '')}
              aria-pressed={prayedTahajjud(stored)}
              onClick={toggleTahajjud}
            >
              <span className="dot" />
              পড়েছি
              <CheckIcon size={14} />
            </button>
            {partner ? (
              <span className="tj-card-partner">
                {partner.name}: {prayedTahajjud(storedTheirs) ? 'পড়েছেন' : 'লেখেননি'}
              </span>
            ) : null}
          </div>
          <Link href="/tahajjud" className="tj-card-link">
            নিয়ত, রিজিকের দোয়া আর পুরো খাতা
            <ChevronIcon dir="right" size={15} />
          </Link>
        </section>

        <div ref={monthRef}>
          <MonthReport
            records={records}
            partner={partner}
            meName={me.name}
            missedFrom={missedFrom}
            settle={settle}
            onSettle={handleSettle}
            monthReq={monthReq}
            dateKey={dateKey}
            onSelectDay={(k) => {
              setDateKey(k);
              playSound('save', soundOn);
              if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      </main>

      <div className="footbar">
        <div className="footbar-inner">
          <div>
            <div className="lead">
              {isToday ? 'আজকের জরিমানা' : 'এই দিনের জরিমানা'} · {bnNum(filled)}/
              {bnNum(PRAYERS.length)} ওয়াক্ত লেখা
            </div>
            <div className="pair">
              <span>৳ {bnNum(myTotal)}</span>
              <small>{me.name}</small>
              {partner ? (
                <>
                  <span style={{ color: 'var(--muted)' }}>·</span>
                  <span>৳ {bnNum(theirTotal)}</span>
                  <small>{partner.name}</small>
                </>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className="foot-action"
            onClick={() => {
              if (monthRef.current) {
                monthRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
              playSound('save', soundOn);
            }}
          >
            মাসের খাতা
          </button>
        </div>
      </div>
    </>
  );
}
