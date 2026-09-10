'use client';

import { useEffect, useRef, useState } from 'react';
import PageHead from './PageHead';
import { CheckIcon, PlayIcon, PauseIcon } from './Icons';
import { audioUrlByNumber, loadQari } from '../lib/recite';
import { AMOLS, AMOL_TAGS } from '../lib/content/amols';
import { DUAS, DUA_CATS } from '../lib/content/duas';
import { POINTS } from '../lib/points';
import { bnNum } from '../lib/store';
import { getTicks, setTick } from '../lib/cloud';

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

/* ---------- পুরো পাতা ---------- */

export default function AmolBoard() {
  const [tab, setTab] = useState('dua');
  const [ticks, setTicks] = useState({ dua: [], amol: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [playing, setPlaying] = useState(null); // কোন দোয়া বাজছে
  const audioRef = useRef(null);
  const queueRef = useRef([]);
  const qariRef = useRef(null);

  useEffect(() => {
    qariRef.current = loadQari();
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

  useEffect(() => {
    getTicks()
      .then((d) => {
        setTicks(d.ticks || { dua: [], amol: [] });
        setLoading(false);
      })
      .catch((err) => {
        setMsg(err.message || 'আজকের হিসাব আনা গেল না');
        setLoading(false);
      });
  }, []);

  async function toggle(kind, item) {
    const on = !ticks[kind].includes(item);
    setBusy(kind + ':' + item);
    setMsg('');
    // আগে পর্দায়, তারপর সার্ভারে
    setTicks((t) => ({
      ...t,
      [kind]: on ? [...t[kind], item] : t[kind].filter((x) => x !== item),
    }));
    try {
      await setTick(kind, item, on);
    } catch (err) {
      setTicks((t) => ({
        ...t,
        [kind]: on ? t[kind].filter((x) => x !== item) : [...t[kind], item],
      }));
      setMsg('টিকটা সার্ভারে রাখা গেল না');
    }
    setBusy('');
  }

  const duaDone = ticks.dua.length;
  const amolDone = ticks.amol.length;
  const points = duaDone * POINTS.dua + amolDone * POINTS.amol;

  return (
    <main className="shell">
      <PageHead
        title="দোয়া ও আমল"
        sub={`আজ ${bnNum(duaDone + amolDone)} টি · ${bnNum(points)} পয়েন্ট`}
      />

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
              <div key={c.id}>
                <div className="section-title">
                  {c.name}
                  <span className="cat-count">
                    {bnNum(done)}/{bnNum(items.length)}
                  </span>
                </div>
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
              </div>
            );
          })
        : null}

      {!loading && tab === 'amol'
        ? AMOL_TAGS.map((tag) => {
            const items = AMOLS.filter((a) => a.tag === tag);
            if (!items.length) return null;
            const done = items.filter((a) => ticks.amol.includes(a.id)).length;
            return (
              <div key={tag}>
                <div className="section-title">
                  {tag}
                  <span className="cat-count">
                    {bnNum(done)}/{bnNum(items.length)}
                  </span>
                </div>
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
              </div>
            );
          })
        : null}

      <p className="month-foot">প্রতিদিন রাত ১২টায় টিকগুলো নতুন করে শুরু হয়।</p>
    </main>
  );
}
