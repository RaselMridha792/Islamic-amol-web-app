'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import PageHead from './PageHead';
import { CheckIcon, ChevronIcon, MoonIcon, PauseIcon, PlayIcon } from './Icons';
import { DUAS } from '../lib/content/duas';
import { TAHAJJUD } from '../lib/content/tahajjud';
import { audioUrlByNumber, loadQari } from '../lib/recite';
import { TAHAJJUD_KEY, prayedTahajjud, tahajjudStats } from '../lib/tahajjud';
import { mergeRecords, pullAll, pushChanges } from '../lib/cloud';
import {
  BN_DAYS_SHORT,
  bnNum,
  currentYm,
  firstWeekdayOf,
  formatDate,
  formatDayName,
  formatYm,
  loadMeta,
  loadPartnerCache,
  loadRecords,
  monthKeysOf,
  saveMeta,
  savePartnerCache,
  saveRecords,
  shiftDay,
  shiftMonth,
  todayKey,
  ymOf,
} from '../lib/store';

// তাহাজ্জুদের খাতা — কত রাত পড়লেন, আর নিয়ত, নিয়ম ও তাহাজ্জুদের পরের দোয়া।
//
// হিসাবটা নামাজের খাতার সেই দিনের লেখাতেই থাকে (lib/tahajjud.js), তাই
// জমা রাখা আর সার্ভারের সাথে মেলানো নামাজের পাতার মতোই: আগে ফোনে, তারপর
// সার্ভারে; দুই কপির যেটা পরে বদলেছে সেটাই টেকে।

const EMPTY = {};
const DUA_BY_ID = new Map(DUAS.map((d) => [d.id, d]));

/* ---------- দোয়া বা আয়াত — পড়া আর শোনা ---------- */

function DuaBlock({ item, title, when, playing, onPlay, startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  const canPlay = Array.isArray(item.audio) && item.audio.length > 0;
  return (
    <section className="item-card tj-dua">
      <header className="item-head">
        <button type="button" className="item-title" onClick={() => setOpen((v) => !v)}>
          <b>
            {title || item.title}
            {item.count ? <em className="count-badge">{bnNum(item.count)} বার</em> : null}
          </b>
          {when || item.when ? <small>{when || item.when}</small> : null}
        </button>
        {canPlay ? (
          <button
            type="button"
            className={'ayah-play' + (playing ? ' on' : '')}
            aria-label={playing ? 'থামান' : 'তিলাওয়াত শুনুন'}
            onClick={onPlay}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
        ) : null}
      </header>
      {open ? (
        <div className="dua-body">
          <p className="ayah-ar">{item.ar}</p>
          {item.tr ? <p className="ayah-tr">{item.tr}</p> : null}
          <p className="ayah-bn">{item.bn}</p>
          {item.ref ? <div className="dua-ref">{item.ref}</div> : null}
        </div>
      ) : (
        <button type="button" className="item-more" onClick={() => setOpen(true)}>
          পড়ুন
        </button>
      )}
    </section>
  );
}

/* ---------- মাসের খাতা ---------- */

function MonthNights({ days, day, onPick }) {
  const [anchor, setAnchor] = useState(() => ymOf(day));
  const [seen, setSeen] = useState(day);
  if (seen !== day) {
    if (ymOf(day) !== ymOf(seen)) setAnchor(ymOf(day));
    setSeen(day);
  }
  const today = todayKey();
  const keys = monthKeysOf(anchor);
  const lead = firstWeekdayOf(anchor);
  const count = keys.filter((k) => prayedTahajjud(days[k])).length;

  return (
    <>
      <div className="month-head">
        <button type="button" className="nav" onClick={() => setAnchor(shiftMonth(anchor, -1))} aria-label="আগের মাস">
          <ChevronIcon dir="left" />
        </button>
        <div className="month-title">
          <strong>{formatYm(anchor)}</strong>
          <span>{bnNum(count)} রাত তাহাজ্জুদ</span>
        </div>
        <button
          type="button"
          className="nav"
          onClick={() => setAnchor(shiftMonth(anchor, 1))}
          disabled={anchor >= currentYm()}
          aria-label="পরের মাস"
        >
          <ChevronIcon dir="right" />
        </button>
      </div>
      <div className="calendar">
        <div className="cal-week">
          {BN_DAYS_SHORT.map((d) => (
            <span className="cal-wd" key={d}>
              {d}
            </span>
          ))}
        </div>
        <div className="cal-grid">
          {Array.from({ length: lead }).map((_, i) => (
            <span className="cal-cell blank" key={'b' + i} />
          ))}
          {keys.map((k) => {
            const on = prayedTahajjud(days[k]);
            const future = k > today;
            return (
              <button
                key={k}
                type="button"
                className={
                  'cal-cell' +
                  (on ? ' tj-on' : '') +
                  (k === day ? ' active' : '') +
                  (k === today ? ' today' : '') +
                  (future ? ' future' : '')
                }
                disabled={future}
                onClick={() => onPick(k)}
                aria-label={`${k} — ${on ? 'পড়েছেন' : 'লেখা নেই'}`}
              >
                <span className="cal-d">{bnNum(Number(k.slice(8)))}</span>
                <span className="cal-tk tj-mark">{on ? <MoonIcon size={13} /> : ''}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ---------- পুরো পাতা ---------- */

export default function TahajjudPage() {
  const [ready, setReady] = useState(false);
  const [records, setRecords] = useState({});
  const [partner, setPartner] = useState(null);
  const [day, setDay] = useState(todayKey());
  const [sync, setSync] = useState('syncing');
  const [playing, setPlaying] = useState(null);
  const recordsRef = useRef({});
  const metaRef = useRef({});
  const pendingRef = useRef(new Map());
  const busyRef = useRef(false);
  const audioRef = useRef(null);
  const queueRef = useRef([]);

  /* ---- সার্ভারের সাথে মেলানো — নামাজের পাতার একই নিয়মে ---- */

  const pushPending = useCallback(async () => {
    const list = Array.from(pendingRef.current.values());
    if (!list.length) return;
    pendingRef.current.clear();
    try {
      await pushChanges({ days: list });
      setSync('ok');
    } catch (err) {
      // না গেলে সারিতে ফেরত, পরের মেলানোয় যাবে
      list.forEach((d) => {
        if (!pendingRef.current.has(d.day)) pendingRef.current.set(d.day, d);
      });
      setSync('error');
    }
  }, []);

  const fullSync = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setSync('syncing');
    try {
      await pushPending();
      const remote = await pullAll();
      const merged = mergeRecords(recordsRef.current, metaRef.current, remote.days || {});
      recordsRef.current = merged.records;
      metaRef.current = merged.meta;
      saveRecords(merged.records);
      saveMeta(merged.meta);
      setRecords(merged.records);
      setPartner(remote.partner || null);
      savePartnerCache(remote.partner || null);
      if (merged.toPush.length) await pushChanges({ days: merged.toPush });
      setSync('ok');
    } catch (err) {
      setSync('error');
    } finally {
      busyRef.current = false;
    }
  }, [pushPending]);

  useEffect(() => {
    const r = loadRecords();
    recordsRef.current = r;
    metaRef.current = loadMeta();
    setRecords(r);
    setPartner(loadPartnerCache());
    setReady(true);
    fullSync();
    const onFocus = () => fullSync();
    window.addEventListener('focus', onFocus);
    const a = audioRef.current;
    return () => {
      window.removeEventListener('focus', onFocus);
      if (a) {
        a.pause();
        a.removeAttribute('src');
      }
    };
  }, [fullSync]);

  function toggle(forDay) {
    const base = recordsRef.current[forDay] || EMPTY;
    const next = { ...base };
    if (prayedTahajjud(base)) delete next[TAHAJJUD_KEY];
    else next[TAHAJJUD_KEY] = true;
    const at = Date.now();
    recordsRef.current = { ...recordsRef.current, [forDay]: next };
    metaRef.current = { ...metaRef.current, [forDay]: at };
    saveRecords(recordsRef.current);
    saveMeta(metaRef.current);
    setRecords(recordsRef.current);
    pendingRef.current.set(forDay, { day: forDay, data: next, updatedAt: at });
    setSync('syncing');
    pushPending();
  }

  /* ---- দোয়া শোনা: এক দোয়ার আয়াতগুলো পরপর, শেষ হলে থামে ---- */

  function play(key, audio) {
    const a = audioRef.current;
    if (!a) return;
    if (playing === key) {
      a.pause();
      queueRef.current = [];
      setPlaying(null);
      return;
    }
    queueRef.current = audio.slice();
    setPlaying(key);
    playNext();
  }

  function playNext() {
    const a = audioRef.current;
    const n = queueRef.current.shift();
    if (n === undefined) {
      setPlaying(null);
      return;
    }
    a.src = audioUrlByNumber(n, loadQari());
    a.play().catch(() => {
      queueRef.current = [];
      setPlaying(null);
    });
  }

  const today = todayKey();
  const isToday = day === today;
  const on = prayedTahajjud(records[day]);
  const mine = tahajjudStats(records, today);
  const theirs = partner && partner.days ? tahajjudStats(partner.days, today) : null;
  const partnerOn = partner && partner.days ? prayedTahajjud(partner.days[day]) : false;

  const duaList = (ids) =>
    ids
      .map((id) => DUA_BY_ID.get(id))
      .filter(Boolean)
      .map((d) => (
        <DuaBlock
          key={d.id}
          item={d}
          playing={playing === d.id}
          onPlay={() => play(d.id, d.audio || [])}
        />
      ));

  if (!ready) return <main className="shell" />;

  return (
    <main className="shell">
      <PageHead
        title="তাহাজ্জুদ"
        sub="রাতের নামাজের খাতা"
        right={
          <Link href="/" className="icon-btn" aria-label="নামাজের খাতায় ফিরুন">
            <ChevronIcon dir="left" />
          </Link>
        }
      />

      <div className="datebar">
        <button type="button" className="nav" onClick={() => setDay(shiftDay(day, -1))} aria-label="আগের দিন">
          <ChevronIcon dir="left" />
        </button>
        <div className="center">
          <strong>{isToday ? 'আজ, ' + formatDayName(day) : formatDayName(day)}</strong>
          <span>{formatDate(day)}</span>
        </div>
        <button
          type="button"
          className="nav"
          onClick={() => setDay(shiftDay(day, 1))}
          disabled={isToday}
          aria-label="পরের দিন"
        >
          <ChevronIcon dir="right" />
        </button>
      </div>
      {!isToday ? (
        <button type="button" className="today-chip" style={{ marginTop: -6, marginBottom: 12 }} onClick={() => setDay(today)}>
          আজকের দিনে ফিরে যান
        </button>
      ) : null}

      {/* ---- এই দিনে পড়েছি ---- */}
      <section className={'tj-mark-card' + (on ? ' on' : '')}>
        <div className="tj-moon" aria-hidden="true">
          <MoonIcon size={30} />
        </div>
        <div className="tj-mark-text">
          <b>{on ? 'আলহামদুলিল্লাহ — পড়া হয়েছে' : isToday ? 'আজ তাহাজ্জুদ পড়েছেন?' : 'এই দিনে তাহাজ্জুদ পড়েছিলেন?'}</b>
          <small>রাত ১২টার পরে পড়লে সেই ভোরের তারিখেই লিখুন</small>
        </div>
        <button
          type="button"
          className={'tj-mark-btn' + (on ? ' on' : '')}
          aria-pressed={on}
          onClick={() => toggle(day)}
        >
          <CheckIcon size={16} /> {on ? 'পড়েছি' : 'পড়েছি লিখুন'}
        </button>
      </section>
      {partner ? (
        <p className="tj-partner">
          {partner.name} {isToday ? 'আজ' : 'এই দিনে'} {partnerOn ? 'পড়েছেন' : 'এখনো লেখেননি'}
        </p>
      ) : null}
      {sync === 'error' ? (
        <p className="tj-partner" style={{ color: 'var(--warn)' }}>
          সার্ভারে পৌঁছানো যায়নি — ফোনে রাখা আছে, নেট এলে নিজেই চলে যাবে
        </p>
      ) : null}

      {/* ---- কত রাত ---- */}
      <div className="tj-stats">
        <div>
          <b>{bnNum(mine.month)}</b>
          <small>এ মাসে</small>
        </div>
        <div>
          <b>{bnNum(mine.streak)}</b>
          <small>টানা রাত</small>
        </div>
        <div>
          <b>{bnNum(mine.total)}</b>
          <small>সব মিলিয়ে</small>
        </div>
      </div>
      <p className="tj-partner">
        সবচেয়ে লম্বা টানা: {bnNum(mine.best)} রাত
        {theirs ? ` · ${partner.name}: এ মাসে ${bnNum(theirs.month)}, টানা ${bnNum(theirs.streak)}` : ''}
      </p>

      <div className="section-title">মাসের খাতা</div>
      <MonthNights
        days={records}
        day={day}
        onPick={(k) => {
          setDay(k);
          if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* ---- নিয়ত ---- */}
      <div className="section-title">নিয়ত</div>
      <section className="item-card tj-niyyah">
        <p className="ayah-ar">{TAHAJJUD.niyyah.ar}</p>
        <p className="ayah-tr">{TAHAJJUD.niyyah.tr}</p>
        <p className="ayah-bn">{TAHAJJUD.niyyah.bn}</p>
        <p className="tj-note">{TAHAJJUD.niyyah.note}</p>
      </section>

      {/* ---- কীভাবে পড়বেন ---- */}
      <div className="section-title">কীভাবে পড়বেন</div>
      <div className="tj-guide">
        {TAHAJJUD.guide.map((g) => (
          <div key={g.k} className="tj-guide-row">
            <b>{g.k}</b>
            <span>{g.v}</span>
          </div>
        ))}
      </div>
      <div className="item-list" style={{ marginTop: 10 }}>
        <DuaBlock
          item={TAHAJJUD.ayah}
          title="তাহাজ্জুদের আয়াত"
          when="আল্লাহ তা‘আলার আদেশ — রাতে তাহাজ্জুদ পড়ুন"
          playing={playing === 'ayah'}
          onPlay={() => play('ayah', TAHAJJUD.ayah.audio)}
        />
      </div>

      {/* ---- রিজিক ---- */}
      <div className="section-title">রিজিক বৃদ্ধির দোয়া</div>
      <div className="item-list">
        {duaList(TAHAJJUD.rizq)}
        <DuaBlock
          item={TAHAJJUD.istighfar}
          title="ইস্তিগফারে রিজিক বাড়ে"
          when="নূহ (আ.)-এর কথা — ক্ষমা চাইলে আল্লাহ সম্পদ ও সন্তান বাড়িয়ে দেন"
          playing={playing === 'istighfar'}
          onPlay={() => play('istighfar', TAHAJJUD.istighfar.audio)}
        />
      </div>

      {/* ---- তাহাজ্জুদের পরে ---- */}
      <div className="section-title">তাহাজ্জুদের পরের দোয়া</div>
      <p className="tj-partner" style={{ marginTop: -4 }}>
        শেষ রাত দোয়া কবুলের সময় — এগুলো পড়ার পর নিজের ভাষাতেও মন খুলে চান।
      </p>
      <div className="item-list">{duaList(TAHAJJUD.after)}</div>

      <audio ref={audioRef} preload="none" onEnded={playNext} />
    </main>
  );
}
