'use client';

import { useEffect, useRef, useState } from 'react';
import PageHead from './PageHead';
import { CheckIcon, PlayIcon, PauseIcon, ChevronIcon } from './Icons';
import { audioUrlByNumber, loadQari } from '../lib/recite';
import { AMOLS, AMOL_TAGS } from '../lib/content/amols';
import { DUAS, DUA_CATS } from '../lib/content/duas';
import { POINTS } from '../lib/points';
import {
  BN_DAYS_SHORT,
  bnNum,
  currentYm,
  firstWeekdayOf,
  formatDate,
  formatDayName,
  formatYm,
  monthKeysOf,
  shiftDay,
  shiftMonth,
  todayKey,
  ymOf,
} from '../lib/store';
import { getTickMonth, getTicks, setTick } from '../lib/cloud';

// দোয়া ও আমলের খাতা — দিন ধরে, নামাজের খাতার মতো।
//
// আগে শুধু আজকেরটা দেখা যেত, আর রাত ১২টা পেরোলেই সেটা পরের দিন হয়ে যেত — রাত
// সাড়ে এগারোটার আমল ১২টার পরে টিক দিলে সেটা ভুল দিনে উঠত। এখন উপরে তারিখ
// বদলানো যায়, আর নিচে মাসের খাতায় কোন দিন কতটা হলো দেখা যায়।

// রাত ১২টা থেকে এই সময় পর্যন্ত "গতকালের আমল লিখবেন?" মনে করিয়ে দিই
const LATE_NIGHT_UNTIL = 5;

function Tick({ on, onClick, busy }) {
  return (
    <button
      type="button"
      className={'item-tick' + (on ? ' on' : '')}
      aria-pressed={on}
      aria-label={on ? 'টিক তুলে নিন' : 'হয়েছে চিহ্ন দিন'}
      disabled={busy}
      onClick={onClick}
    >
      <CheckIcon size={15} />
    </button>
  );
}

/* ---------- দোয়া ---------- */

function DuaCard({ dua, on, onToggle, busy, playing, onPlay }) {
  const [open, setOpen] = useState(false);
  const canPlay = Array.isArray(dua.audio) && dua.audio.length > 0;
  return (
    <section className={'item-card' + (on ? ' done' : '')}>
      <header className="item-head">
        <button type="button" className="item-title" onClick={() => setOpen((v) => !v)}>
          <b>
            {dua.title}
            {dua.count ? <em className="count-badge">{bnNum(dua.count)} বার</em> : null}
          </b>
          <small>{dua.when}</small>
        </button>
        <div className="ayah-acts">
          {canPlay ? (
            <button
              type="button"
              className={'ayah-play' + (playing ? ' on' : '')}
              aria-label={playing ? 'থামান' : 'তিলাওয়াত শুনুন'}
              onClick={() => onPlay(dua)}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
          ) : null}
          <Tick on={on} busy={busy} onClick={onToggle} />
        </div>
      </header>

      {open ? (
        <div className="dua-body">
          <p className="ayah-ar">{dua.ar}</p>
          <p className="ayah-tr">{dua.tr}</p>
          <p className="ayah-bn">{dua.bn}</p>
          <div className="dua-ref">{dua.ref}</div>
        </div>
      ) : (
        <button type="button" className="item-more" onClick={() => setOpen(true)}>
          পড়ুন
        </button>
      )}
    </section>
  );
}

/* ---------- আমল ---------- */

function AmolCard({ amol, on, onToggle, busy }) {
  return (
    <section className={'item-card' + (on ? ' done' : '')}>
      <header className="item-head">
        <div className="item-title as-text">
          <b>{amol.title}</b>
          <small>{amol.tag}</small>
        </div>
        <Tick on={on} busy={busy} onClick={onToggle} />
      </header>
      <p className="item-body">{amol.body}</p>
    </section>
  );
}

/* ---------- গোটানো শ্রেণি ---------- */
// সবগুলো একসাথে খোলা থাকলে পাতাটা এলোমেলো লাগে, তাই বন্ধ অবস্থায় শুরু হয়

function Group({ name, done, total, open, onToggle, children }) {
  return (
    <section className={'group' + (open ? ' open' : '')}>
      <button type="button" className="group-head" onClick={onToggle} aria-expanded={open}>
        <span className="group-name">{name}</span>
        <span className="group-count">
          {bnNum(done)}/{bnNum(total)}
        </span>
        <span className="group-arrow" aria-hidden="true">
          <ChevronIcon dir={open ? 'left' : 'right'} size={16} />
        </span>
      </button>
      {open ? <div className="group-body">{children}</div> : null}
    </section>
  );
}

/* ---------- মাসের খাতা ---------- */
// প্রতিটা দিনে কয়টা দোয়া-আমল হলো — রঙ যত গাঢ়, তত বেশি। চাপ দিলে সেই দিনটা খোলে।

function MonthBook({ day, counts, onPick }) {
  const [anchor, setAnchor] = useState(() => ymOf(day));
  const [seen, setSeen] = useState(day);
  if (seen !== day) {
    if (ymOf(day) !== ymOf(seen)) setAnchor(ymOf(day));
    setSeen(day);
  }

  const [data, setData] = useState({ month: null, days: {} });
  useEffect(() => {
    let alive = true;
    getTickMonth(anchor)
      .then((d) => alive && setData({ month: anchor, days: d.days || {} }))
      .catch(() => alive && setData({ month: anchor, days: {} }));
    return () => {
      alive = false;
    };
  }, [anchor]);

  const today = todayKey();
  const keys = monthKeysOf(anchor);
  const lead = firstWeekdayOf(anchor);
  // এই দিনে যা বদলাল, সার্ভারে আবার না গিয়েই সেটা বসিয়ে নিই
  const dayCount = (k) => {
    if (k === day && counts) return counts.dua + counts.amol;
    const c = data.month === anchor ? data.days[k] : null;
    return c ? c.dua + c.amol : 0;
  };
  let monthTotal = 0;
  let activeDays = 0;
  keys.forEach((k) => {
    const n = dayCount(k);
    monthTotal += n;
    if (n > 0) activeDays += 1;
  });

  return (
    <>
      <div className="month-head">
        <button type="button" className="nav" onClick={() => setAnchor(shiftMonth(anchor, -1))} aria-label="আগের মাস">
          <ChevronIcon dir="left" />
        </button>
        <div className="month-title">
          <strong>{formatYm(anchor)}</strong>
          <span>
            {bnNum(activeDays)} দিনে {bnNum(monthTotal)}টি দোয়া-আমল
          </span>
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
            const n = dayCount(k);
            const future = k > today;
            const level = n === 0 ? 0 : n < 5 ? 1 : n < 12 ? 2 : 3;
            return (
              <button
                key={k}
                type="button"
                className={
                  'cal-cell amol-l' +
                  level +
                  (k === day ? ' active' : '') +
                  (k === today ? ' today' : '') +
                  (future ? ' future' : '')
                }
                disabled={future}
                onClick={() => onPick(k)}
                aria-label={`${k} — ${n}টি`}
              >
                <span className="cal-d">{bnNum(Number(k.slice(8)))}</span>
                <span className="cal-tk amol-n">{n ? bnNum(n) + 'টি' : ''}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ---------- পুরো পাতা ---------- */

export default function AmolBoard() {
  const [tab, setTab] = useState('dua');
  const [day, setDay] = useState(todayKey());
  const [openCats, setOpenCats] = useState({});
  const toggleCat = (k) => setOpenCats((o) => ({ ...o, [k]: !o[k] }));
  const [ticks, setTicks] = useState({ dua: [], amol: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [lateNight, setLateNight] = useState(false);
  const [playing, setPlaying] = useState(null); // কোন দোয়া বাজছে
  const audioRef = useRef(null);
  const queueRef = useRef([]);
  const qariRef = useRef(null);
  const dayRef = useRef(day);
  dayRef.current = day;

  useEffect(() => {
    qariRef.current = loadQari();
    // সময়টা ফোনের, তাই এখানে — সার্ভারে আঁকার সময় জানা নেই
    setLateNight(new Date().getHours() < LATE_NIGHT_UNTIL);
    const a = audioRef.current;
    return () => {
      if (a) {
        a.pause();
        a.removeAttribute('src');
      }
    };
  }, []);

  // একটা দোয়ার আয়াতগুলো পরপর বাজে — দোয়াটা তো একটাই জিনিস।
  // দোয়া শেষ হলে থেমে যায়, নিজে থেকে পরের দোয়ায় যায় না।
  function playDua(dua) {
    const a = audioRef.current;
    if (!a) return;
    if (playing === dua.id) {
      a.pause();
      queueRef.current = [];
      setPlaying(null);
      return;
    }
    queueRef.current = dua.audio.slice();
    setPlaying(dua.id);
    playNext();
  }

  function playNext() {
    const a = audioRef.current;
    const n = queueRef.current.shift();
    if (n === undefined) {
      setPlaying(null);
      return;
    }
    a.src = audioUrlByNumber(n, qariRef.current || undefined);
    a.play().catch(() => {
      queueRef.current = [];
      setPlaying(null);
      setMsg('তিলাওয়াতটা চালানো গেল না');
    });
  }

  // দিন বদলালে সেই দিনের টিক আনি
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setMsg('');
    getTicks(day)
      .then((d) => {
        if (!alive) return;
        setTicks(d.ticks || { dua: [], amol: [] });
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setTicks({ dua: [], amol: [] });
        setMsg(err.message || 'এই দিনের হিসাব আনা গেল না');
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [day]);

  async function toggle(kind, item) {
    // যে দিনের পাতা খোলা, টিকটা সেই দিনেরই — মাঝপথে দিন বদলালেও
    const forDay = day;
    const on = !ticks[kind].includes(item);
    setBusy(kind + ':' + item);
    setMsg('');
    // আগে পর্দায়, তারপর সার্ভারে
    setTicks((t) => ({
      ...t,
      [kind]: on ? [...t[kind], item] : t[kind].filter((x) => x !== item),
    }));
    try {
      await setTick(kind, item, on, forDay);
    } catch (err) {
      if (dayRef.current === forDay) {
        setTicks((t) => ({
          ...t,
          [kind]: on ? t[kind].filter((x) => x !== item) : [...t[kind], item],
        }));
      }
      setMsg(err.message || 'টিকটা সার্ভারে রাখা গেল না');
    }
    setBusy('');
  }

  function goDay(next) {
    if (next > todayKey()) return;
    setDay(next);
  }

  const today = todayKey();
  const isToday = day === today;
  const duaDone = ticks.dua.length;
  const amolDone = ticks.amol.length;
  const points = duaDone * POINTS.dua + amolDone * POINTS.amol;

  return (
    <main className="shell">
      <PageHead
        title="দোয়া ও আমল"
        sub={`${isToday ? 'আজ' : formatDate(day)} ${bnNum(duaDone + amolDone)} টি · ${bnNum(points)} পয়েন্ট`}
      />

      <div className="datebar">
        <button type="button" className="nav" onClick={() => goDay(shiftDay(day, -1))} aria-label="আগের দিন">
          <ChevronIcon dir="left" />
        </button>
        <div className="center">
          <strong>{isToday ? 'আজ, ' + formatDayName(day) : formatDayName(day)}</strong>
          <span>{formatDate(day)}</span>
        </div>
        <button
          type="button"
          className="nav"
          onClick={() => goDay(shiftDay(day, 1))}
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
      ) : lateNight ? (
        // রাত ১২টার একটু পরে — আমলটা হয়তো গতকালের
        <button
          type="button"
          className="today-chip late-chip"
          style={{ marginTop: -6, marginBottom: 12 }}
          onClick={() => setDay(shiftDay(today, -1))}
        >
          রাত ১২টা পেরিয়েছে — গতকালের আমল লিখবেন? গতকালের খাতা খুলুন
        </button>
      ) : null}

      <div className="who-tabs">
        <button
          type="button"
          className={'who-tab' + (tab === 'dua' ? ' on' : '')}
          onClick={() => setTab('dua')}
        >
          দোয়া ({bnNum(duaDone)})
        </button>
        <button
          type="button"
          className={'who-tab' + (tab === 'amol' ? ' on' : '')}
          onClick={() => setTab('amol')}
        >
          আমল ({bnNum(amolDone)})
        </button>
      </div>

      <audio ref={audioRef} preload="none" onEnded={playNext} />
      {msg ? <div className="auth-error">{msg}</div> : null}
      {loading ? <div className="empty-note">আনা হচ্ছে…</div> : null}

      {!loading && tab === 'dua'
        ? DUA_CATS.map((c) => {
            const items = DUAS.filter((d) => d.cat === c.id);
            if (!items.length) return null;
            const done = items.filter((d) => ticks.dua.includes(d.id)).length;
            return (
              <Group
                key={c.id}
                name={c.name}
                done={done}
                total={items.length}
                open={Boolean(openCats['dua:' + c.id])}
                onToggle={() => toggleCat('dua:' + c.id)}
              >
                <div className="item-list">
                  {items.map((d) => (
                    <DuaCard
                      key={d.id}
                      dua={d}
                      on={ticks.dua.includes(d.id)}
                      busy={busy === 'dua:' + d.id}
                      playing={playing === d.id}
                      onPlay={playDua}
                      onToggle={() => toggle('dua', d.id)}
                    />
                  ))}
                </div>
              </Group>
            );
          })
        : null}

      {!loading && tab === 'amol'
        ? AMOL_TAGS.map((tag) => {
            const items = AMOLS.filter((a) => a.tag === tag);
            if (!items.length) return null;
            const done = items.filter((a) => ticks.amol.includes(a.id)).length;
            return (
              <Group
                key={tag}
                name={tag}
                done={done}
                total={items.length}
                open={Boolean(openCats['amol:' + tag])}
                onToggle={() => toggleCat('amol:' + tag)}
              >
                <div className="item-list">
                  {items.map((a) => (
                    <AmolCard
                      key={a.id}
                      amol={a}
                      on={ticks.amol.includes(a.id)}
                      busy={busy === 'amol:' + a.id}
                      onToggle={() => toggle('amol', a.id)}
                    />
                  ))}
                </div>
              </Group>
            );
          })
        : null}

      <div className="section-title">মাসের খাতা</div>
      <MonthBook
        day={day}
        counts={loading ? null : { dua: duaDone, amol: amolDone }}
        onPick={(k) => {
          setDay(k);
          if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <p className="month-foot">
        আগের যেকোনো দিনের দোয়া-আমল লেখা যায় — উপরের তীর বা মাসের খাতায় দিন বেছে নিন।
      </p>
    </main>
  );
}
