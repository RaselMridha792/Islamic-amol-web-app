'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PrayerCard from './PrayerCard';
import MonthReport from './MonthReport';
import SettingsSheet from './SettingsSheet';
import AuthSheet from './AuthSheet';
import ToastStack from './Toast';
import Avatar from './Avatar';
import {
  ChevronIcon,
  CloudIcon,
  CrescentIcon,
  GearIcon,
  SoundOffIcon,
  SoundOnIcon,
} from './Icons';
import { PRAYERS, STATUS_MAP, dayTotal, dayFilled } from '../lib/prayers';
import { playSound, warmUpAudio } from '../lib/sound';
import {
  PROFILE_STAMP,
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  mergeProfile,
  mergeRecords,
  pullAll,
  pushChanges,
  register as apiRegister,
} from '../lib/cloud';
import {
  DEFAULT_PEOPLE,
  bnNum,
  formatDate,
  formatDayName,
  loadMeta,
  loadPeople,
  loadRecords,
  loadSoundOn,
  savePeople,
  saveMeta,
  saveRecords,
  saveSoundOn,
  shiftDay,
  todayKey,
} from '../lib/store';

const EMPTY_DAY = { p1: {}, p2: {} };
const PULL_EVERY = 60000;

function normalizePeople(raw) {
  return {
    p1: { ...DEFAULT_PEOPLE.p1, ...((raw && raw.p1) || {}) },
    p2: { ...DEFAULT_PEOPLE.p2, ...((raw && raw.p2) || {}) },
  };
}

export default function PrayerApp() {
  const [ready, setReady] = useState(false);
  const [people, setPeople] = useState(DEFAULT_PEOPLE);
  const [records, setRecords] = useState({});
  const [dateKey, setDateKey] = useState(todayKey());
  const [soundOn, setSoundOn] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [account, setAccount] = useState({ cloud: false, user: null });
  const [sync, setSync] = useState('off');
  const [toasts, setToasts] = useState([]);
  const monthRef = useRef(null);
  const timers = useRef([]);

  // সবসময়ের টাটকা কপি, যাতে সিঙ্ক করার সময় পুরনো ডেটা না পাঠাই
  const recordsRef = useRef({});
  const metaRef = useRef({});
  const peopleRef = useRef(DEFAULT_PEOPLE);
  const signedInRef = useRef(false);
  const pendingRef = useRef(new Set());
  const pushTimer = useRef(null);
  // একসাথে দুইবার মেলানো বা মোছার মাঝখানে মেলানো ঠেকাই
  const busyRef = useRef(false);

  const pushToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { ...toast, id }].slice(-2));
    timers.current.push(
      setTimeout(() => {
        setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      }, 2300)
    );
    timers.current.push(
      setTimeout(() => {
        setToasts((list) => list.filter((t) => t.id !== id));
      }, 2560)
    );
  }, []);

  /* ---------- সিঙ্ক ---------- */

  const dropSession = useCallback(() => {
    signedInRef.current = false;
    setAccount((a) => ({ ...a, user: null }));
    setSync('off');
  }, []);

  // জমে থাকা দিনগুলো সার্ভারে পাঠাই
  const flushPush = useCallback(async () => {
    if (!signedInRef.current || pendingRef.current.size === 0) return;
    const keys = Array.from(pendingRef.current);
    pendingRef.current.clear();
    const days = keys.map((k) => ({
      day: k,
      data: recordsRef.current[k] || EMPTY_DAY,
      updatedAt: metaRef.current[k] || Date.now(),
    }));
    setSync('syncing');
    try {
      await pushChanges({ days });
      setSync('ok');
    } catch (err) {
      // পাঠানো না গেলে আবার সারিতে রেখে দিই, পরের বার যাবে
      keys.forEach((k) => pendingRef.current.add(k));
      if (err.status === 401) dropSession();
      else setSync('error');
    }
  }, [dropSession]);

  const queueDay = useCallback(
    (key) => {
      if (!signedInRef.current) return;
      pendingRef.current.add(key);
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(flushPush, 900);
    },
    [flushPush]
  );

  // পুরো খাতা মিলিয়ে নিই — যেটা পরে বদলেছে সেটাই থাকে
  const fullSync = useCallback(async () => {
    if (!signedInRef.current || busyRef.current) return;
    busyRef.current = true;
    setSync('syncing');
    try {
      const remote = await pullAll();
      const merged = mergeRecords(recordsRef.current, metaRef.current, remote.days || {});
      const prof = mergeProfile(
        peopleRef.current,
        metaRef.current[PROFILE_STAMP] || 0,
        remote.profile
      );

      recordsRef.current = merged.records;
      metaRef.current = { ...merged.meta, [PROFILE_STAMP]: prof.at };
      saveRecords(merged.records);
      saveMeta(metaRef.current);
      setRecords(merged.records);

      if (!prof.push) {
        const next = normalizePeople(prof.people);
        peopleRef.current = next;
        setPeople(next);
        savePeople(next);
      }

      if (merged.toPush.length || prof.push) {
        await pushChanges({
          days: merged.toPush,
          profile: prof.push ? { people: peopleRef.current, updatedAt: prof.at } : null,
        });
      }
      setSync('ok');
    } catch (err) {
      if (err.status === 401) dropSession();
      else setSync('error');
    } finally {
      busyRef.current = false;
    }
  }, [dropSession]);

  useEffect(() => {
    const p = loadPeople();
    const r = loadRecords();
    const m = loadMeta();
    peopleRef.current = p;
    recordsRef.current = r;
    metaRef.current = m;
    setPeople(p);
    setRecords(r);
    setSoundOn(loadSoundOn());
    setDateKey(todayKey());
    setReady(true);

    let alive = true;
    fetchMe()
      .then((res) => {
        if (!alive) return;
        setAccount({ cloud: Boolean(res.cloud), user: res.user || null });
        if (res.user) {
          signedInRef.current = true;
          fullSync();
        }
      })
      .catch(() => {
        // সার্ভারে পৌঁছানো না গেলে অ্যাপ শুধু এই ডিভাইসেই চলবে
      });

    const list = timers.current;
    return () => {
      alive = false;
      list.forEach(clearTimeout);
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [fullSync]);

  // অন্য ডিভাইসের বদল ধরার জন্য মাঝেমধ্যে আর ট্যাবে ফিরলে মিলিয়ে নিই
  useEffect(() => {
    if (!account.user) return undefined;
    const onFocus = () => fullSync();
    window.addEventListener('focus', onFocus);
    const iv = setInterval(fullSync, PULL_EVERY);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(iv);
    };
  }, [account.user, fullSync]);

  /* ---------- দিনের হিসাব ---------- */

  const day = records[dateKey] || EMPTY_DAY;
  const isToday = dateKey === todayKey();

  const totals = useMemo(() => ({ p1: dayTotal(day.p1), p2: dayTotal(day.p2) }), [day]);
  const filled = dayFilled(day.p1) + dayFilled(day.p2);

  const handlePick = useCallback(
    (personId, prayerId, statusId) => {
      warmUpAudio();
      const prayer = PRAYERS.find((p) => p.id === prayerId);
      const status = STATUS_MAP[statusId];
      const person = peopleRef.current[personId];

      const base = recordsRef.current[dateKey] || EMPTY_DAY;
      const currentPerson = base[personId] || {};
      const undo = currentPerson[prayerId] === statusId;

      const nextPerson = { ...currentPerson };
      if (undo) delete nextPerson[prayerId];
      else nextPerson[prayerId] = statusId;

      const next = { ...recordsRef.current, [dateKey]: { ...base, [personId]: nextPerson } };
      const at = Date.now();
      recordsRef.current = next;
      metaRef.current = { ...metaRef.current, [dateKey]: at };
      saveRecords(next);
      saveMeta(metaRef.current);
      setRecords(next);
      queueDay(dateKey);

      if (undo) {
        playSound('clear', soundOn);
        pushToast({
          tone: 'info',
          title: person.name + '-এর ' + prayer.bn + ' আবার খালি',
          body: 'এই ওয়াক্তের হিসাব মুছে দেওয়া হলো',
        });
        return;
      }

      playSound(statusId, soundOn);

      if (statusId === 'prayed') {
        pushToast({
          tone: 'good',
          title: person.name + ' ' + prayer.bn + ' পড়েছে',
          body: 'মাশাআল্লাহ, কোনো জরিমানা নেই',
          amount: '৳ ০',
        });
      } else if (statusId === 'qaza') {
        pushToast({
          tone: 'warn',
          title: person.name + '-এর ' + prayer.bn + ' কাজা',
          body: 'অর্ধেক জরিমানা খাতায় উঠল',
          amount: '+ ৳ ' + bnNum(status.fine),
        });
      } else {
        pushToast({
          tone: 'bad',
          title: person.name + ' ' + prayer.bn + ' পড়েনি',
          body: 'পুরো জরিমানা খাতায় উঠল',
          amount: '+ ৳ ' + bnNum(status.fine),
        });
      }
    },
    [dateKey, pushToast, queueDay, soundOn]
  );

  function goDay(delta) {
    const next = shiftDay(dateKey, delta);
    if (delta > 0 && next > todayKey()) return;
    setDateKey(next);
    playSound('save', soundOn);
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    saveSoundOn(next);
    warmUpAudio();
    playSound('save', next);
    pushToast({
      tone: 'info',
      title: next ? 'শব্দ চালু' : 'শব্দ বন্ধ',
      body: next ? 'প্রতিটি ট্যাপে ছোট একটা সুর বাজবে' : 'এখন থেকে চুপচাপ চলবে',
    });
  }

  function handleSavePeople(nextPeople) {
    const at = Date.now();
    peopleRef.current = nextPeople;
    metaRef.current = { ...metaRef.current, [PROFILE_STAMP]: at };
    setPeople(nextPeople);
    savePeople(nextPeople);
    saveMeta(metaRef.current);
    setSettingsOpen(false);
    playSound('save', soundOn);

    if (signedInRef.current) {
      setSync('syncing');
      pushChanges({ days: [], profile: { people: nextPeople, updatedAt: at } })
        .then(() => setSync('ok'))
        .catch((err) => (err.status === 401 ? dropSession() : setSync('error')));
    }

    pushToast({
      tone: 'info',
      title: 'সেভ হয়ে গেছে',
      body: nextPeople.p1.name + ' আর ' + nextPeople.p2.name + '-এর হিসাব চলবে',
    });
  }

  function handleClearAll() {
    recordsRef.current = {};
    metaRef.current = { [PROFILE_STAMP]: metaRef.current[PROFILE_STAMP] || 0 };
    pendingRef.current.clear();
    setRecords({});
    saveRecords({});
    saveMeta(metaRef.current);
    setSettingsOpen(false);

    if (signedInRef.current) {
      busyRef.current = true;
      setSync('syncing');
      pushChanges({ days: [], wipe: true })
        .then(() => setSync('ok'))
        .catch((err) => (err.status === 401 ? dropSession() : setSync('error')))
        .finally(() => {
          busyRef.current = false;
        });
    }

    pushToast({
      tone: 'bad',
      title: 'সব হিসাব মুছে গেছে',
      body: signedInRef.current ? 'অ্যাকাউন্ট থেকেও মুছে দেওয়া হলো' : 'নতুন করে শুরু করা যাবে',
    });
  }

  /* ---------- অ্যাকাউন্ট ---------- */

  async function finishAuth(res) {
    setAccount({ cloud: true, user: res.user });
    signedInRef.current = true;
    setAuthOpen(false);
    setSettingsOpen(false);
    playSound('save', soundOn);
    pushToast({
      tone: 'good',
      title: res.user.username + ' — লগইন হয়েছে',
      body: 'এই ফোনের হিসাব অ্যাকাউন্টে মিলিয়ে নেওয়া হচ্ছে',
    });
    await fullSync();
  }

  async function handleLogin(username, password) {
    await finishAuth(await apiLogin(username, password));
  }

  async function handleRegister(username, password) {
    await finishAuth(await apiRegister(username, password));
  }

  async function handleLogout() {
    try {
      await apiLogout();
    } catch (err) {
      // সার্ভারে না পৌঁছালেও এই ডিভাইসে লগআউট করে দিই
    }
    signedInRef.current = false;
    pendingRef.current.clear();
    setAccount((a) => ({ ...a, user: null }));
    setSync('off');
    setSettingsOpen(false);
    pushToast({
      tone: 'info',
      title: 'লগআউট হয়ে গেছে',
      body: 'হিসাব এই ফোনেই থেকে যাচ্ছে',
    });
  }

  const syncLabel = {
    syncing: 'মেলানো হচ্ছে…',
    ok: 'সব মিলে আছে',
    error: 'মেলানো যায়নি',
    off: account.cloud ? 'লগইন করা নেই' : 'শুধু এই ফোনে',
  }[sync];

  if (!ready) {
    return (
      <main className="shell">
        <div className="empty-note" style={{ marginTop: 40 }}>
          হিসাবের খাতা খোলা হচ্ছে…
        </div>
      </main>
    );
  }

  return (
    <>
      <ToastStack toasts={toasts} />

      <main className="shell">
        <div className="topbar">
          <div className="brand">
            <div className="crescent">
              <CrescentIcon />
            </div>
            <div>
              <h1>নামাজ হিসাব</h1>
              <p>পাঁচ ওয়াক্তের খাতা</p>
            </div>
          </div>
          <div className="icon-row">
            {account.cloud ? (
              <button
                type="button"
                className={'icon-btn sync-' + sync}
                onClick={() => (account.user ? fullSync() : setAuthOpen(true))}
                aria-label={syncLabel}
                title={syncLabel}
              >
                <CloudIcon state={sync} />
              </button>
            ) : null}
            <button
              type="button"
              className="icon-btn"
              onClick={toggleSound}
              aria-label={soundOn ? 'শব্দ বন্ধ করুন' : 'শব্দ চালু করুন'}
            >
              {soundOn ? <SoundOnIcon /> : <SoundOffIcon />}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSettingsOpen(true)}
              aria-label="সেটিংস"
            >
              <GearIcon />
            </button>
          </div>
        </div>

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
          {['p1', 'p2'].map((id, i) => (
            <div key={id} style={{ display: 'contents' }}>
              {i === 1 ? <div className="duo-sep" /> : null}
              <div className="duo-person">
                <Avatar person={people[id]} />
                <div className="who">{people[id].name}</div>
                <div className={'amount' + (totals[id] === 0 ? ' zero' : '')}>
                  ৳ {bnNum(totals[id])}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="cards">
          {PRAYERS.map((prayer) => (
            <PrayerCard
              key={prayer.id}
              prayer={prayer}
              people={people}
              record={day}
              onPick={handlePick}
            />
          ))}
        </div>

        <div ref={monthRef}>
          <MonthReport
            records={records}
            dateKey={dateKey}
            people={people}
            onSelectDay={(k) => {
              setDateKey(k);
              playSound('save', soundOn);
              if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>

        <p className="dua">
          <span className="ar">إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا</span>
          নিশ্চয়ই নামাজ মুমিনদের উপর নির্দিষ্ট সময়ে ফরজ · সূরা আন-নিসা, আয়াত ১০৩
        </p>
      </main>

      <div className="footbar">
        <div className="footbar-inner">
          <div>
            <div className="lead">
              {isToday ? 'আজকের জরিমানা' : 'এই দিনের জরিমানা'} ·{' '}
              {bnNum(filled)}/{bnNum(PRAYERS.length * 2)} ওয়াক্ত লেখা
            </div>
            <div className="pair">
              <span>৳ {bnNum(totals.p1)}</span>
              <small>{people.p1.name}</small>
              <span style={{ color: 'var(--muted)' }}>·</span>
              <span>৳ {bnNum(totals.p2)}</span>
              <small>{people.p2.name}</small>
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

      {settingsOpen ? (
        <SettingsSheet
          people={people}
          soundOn={soundOn}
          account={account}
          syncLabel={syncLabel}
          onToggleSound={toggleSound}
          onSave={handleSavePeople}
          onClose={() => setSettingsOpen(false)}
          onClearAll={handleClearAll}
          onOpenAuth={() => {
            setSettingsOpen(false);
            setAuthOpen(true);
          }}
          onLogout={handleLogout}
          onError={(msg) => pushToast({ tone: 'bad', title: 'ছবি যোগ হয়নি', body: msg })}
        />
      ) : null}

      {authOpen ? (
        <AuthSheet
          onLogin={handleLogin}
          onRegister={handleRegister}
          onClose={() => setAuthOpen(false)}
        />
      ) : null}
    </>
  );
}
