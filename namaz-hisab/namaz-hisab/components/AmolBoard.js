'use client';

import { useEffect, useState } from 'react';
import PageHead from './PageHead';
import { CheckIcon } from './Icons';
import { AMOLS } from '../lib/content/amols';
import { DUAS } from '../lib/content/duas';
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

function DuaCard({ dua, on, onToggle, busy }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={'item-card' + (on ? ' done' : '')}>
      <header className="item-head">
        <button type="button" className="item-title" onClick={() => setOpen((v) => !v)}>
          <b>{dua.title}</b>
          <small>{dua.when}</small>
        </button>
        <Tick on={on} busy={busy} onClick={onToggle} />
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

      {msg ? <div className="auth-error">{msg}</div> : null}
      {loading ? <div className="empty-note">আনা হচ্ছে…</div> : null}

      {!loading && tab === 'dua' ? (
        <div className="item-list">
          {DUAS.map((d) => (
            <DuaCard
              key={d.id}
              dua={d}
              on={ticks.dua.includes(d.id)}
              busy={busy === 'dua:' + d.id}
              onToggle={() => toggle('dua', d.id)}
            />
          ))}
        </div>
      ) : null}

      {!loading && tab === 'amol' ? (
        <div className="item-list">
          {AMOLS.map((a) => (
            <AmolCard
              key={a.id}
              amol={a}
              on={ticks.amol.includes(a.id)}
              busy={busy === 'amol:' + a.id}
              onToggle={() => toggle('amol', a.id)}
            />
          ))}
        </div>
      ) : null}

      <p className="month-foot">প্রতিদিন রাত ১২টায় টিকগুলো নতুন করে শুরু হয়।</p>
    </main>
  );
}
