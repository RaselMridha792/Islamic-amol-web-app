'use client';

import { useEffect, useState } from 'react';
import PageHead from './PageHead';
import DrawPad from './DrawPad';
import { HeartIcon, PenIcon, StarIcon, VibrateIcon } from './Icons';
import { bnNum } from '../lib/store';
import { getDashboard, getTouchStatus, sendBuzz } from '../lib/cloud';

function Bar({ value, max, tone }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="dash-bar">
      <i className={tone} style={{ width: Math.max(pct, value > 0 ? 4 : 0) + '%' }} />
    </div>
  );
}

// দুজনের একই মাপকাঠি পাশাপাশি — তুলনা করতে সুবিধা
function Row({ label, a, b, max, tone, unit }) {
  return (
    <div className={'dash-row' + (b === null ? ' solo' : '')}>
      <div className="dash-label">{label}</div>
      <div className="dash-side">
        <span>
          {bnNum(a)}
          {unit ? <small>{unit}</small> : null}
        </span>
        <Bar value={a} max={max} tone={tone} />
      </div>
      {b !== null ? (
        <div className="dash-side">
          <span>
            {bnNum(b)}
            {unit ? <small>{unit}</small> : null}
          </span>
          <Bar value={b} max={max} tone={tone} />
        </div>
      ) : null}
    </div>
  );
}

/* ---------- স্পর্শ: সঙ্গীর স্ক্রিনে আঁকা, ফোন কাঁপানো ---------- */

function TouchCard({ partnerName }) {
  const [info, setInfo] = useState(null);
  const [pad, setPad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ tone: '', text: '' });

  useEffect(() => {
    getTouchStatus()
      .then((d) => setInfo(d.partner || null))
      .catch(() => {});
  }, []);

  const name = (info && info.name) || partnerName;
  // সঙ্গী নিজের সেটিংসে বন্ধ রাখলে বোতামও বন্ধ
  const canDraw = !info || info.draw;
  const canBuzz = !info || info.buzz;

  async function buzz() {
    setBusy(true);
    setNote({ tone: '', text: '' });
    try {
      const r = await sendBuzz();
      setNote(
        r.sent > 0
          ? { tone: 'good', text: `${name}-এর ফোনে পাঠানো হলো` }
          : { tone: 'warn', text: `${name}-এর ফোনে নোটিফিকেশন পৌঁছাচ্ছে না — অ্যাপ খুললে জানবেন` }
      );
    } catch (err) {
      setNote({ tone: 'bad', text: err.message || 'পাঠানো গেল না' });
    }
    setBusy(false);
  }

  return (
    <section className="touch-card">
      <div className="touch-head">
        <HeartIcon size={16} filled />
        <b>{name}-কে ছুঁয়ে দিন</b>
      </div>
      <p>
        আপনি আঁকবেন, সাথে সাথে {name}-এর স্ক্রিনে ফুটে উঠবে। আর এক চাপে তার ফোন
        কাঁপিয়ে জানান দিতে পারেন।
      </p>
      <div className="touch-actions">
        <button type="button" className="btn primary" disabled={!canDraw} onClick={() => setPad(true)}>
          <PenIcon size={17} /> আঁকুন
        </button>
        <button type="button" className="btn" disabled={!canBuzz || busy} onClick={buzz}>
          <VibrateIcon size={17} /> কাঁপান
        </button>
      </div>

      {info && info.devices === 0 ? (
        <p className="touch-note warn">
          {name}-এর ফোনে নোটিফিকেশন চালু নেই। উনি সেটিংস থেকে চালু করলে তবেই সাথে সাথে পৌঁছাবে —
          নইলে ১৫ মিনিটের মধ্যে অ্যাপ খুললে দেখবেন।
        </p>
      ) : null}
      {info && !info.draw ? <p className="touch-note">{name} স্ক্রিনে আঁকা বন্ধ রেখেছেন।</p> : null}
      {info && !info.buzz ? <p className="touch-note">{name} ফোন কাঁপানো বন্ধ রেখেছেন।</p> : null}
      {note.text ? <p className={'touch-note ' + note.tone}>{note.text}</p> : null}

      {pad ? <DrawPad partner={name} onClose={() => setPad(false)} /> : null}
    </section>
  );
}

export default function Dashboard() {
  const [state, setState] = useState({ loading: true, me: null, partner: null, error: '' });

  useEffect(() => {
    getDashboard()
      .then((d) => setState({ loading: false, me: d.me, partner: d.partner, error: '' }))
      .catch((err) =>
        setState({ loading: false, me: null, partner: null, error: err.message || 'আনা গেল না' })
      );
  }, []);

  if (state.loading) {
    return (
      <main className="shell">
        <PageHead title="আমরা" sub="দুজনের হিসাব একসাথে" />
        <div className="empty-note" style={{ marginTop: 20 }}>আনা হচ্ছে…</div>
      </main>
    );
  }

  if (state.error || !state.me) {
    return (
      <main className="shell">
        <PageHead title="আমরা" sub="দুজনের হিসাব একসাথে" />
        <div className="auth-error" style={{ marginTop: 20 }}>{state.error || 'কিছু পাওয়া গেল না'}</div>
      </main>
    );
  }

  const { me, partner } = state;
  const p = partner;
  const both = [me, p].filter(Boolean);
  const maxPoints = Math.max(...both.map((x) => x.points.total), 1);
  const maxAyah = Math.max(...both.map((x) => x.quran.ayahs), 1);
  const maxFine = Math.max(...both.map((x) => x.namaz.monthFine), 1);

  return (
    <main className="shell">
      <PageHead title="আমরা" sub="দুজনের হিসাব একসাথে" />

      <div className={'month-total' + (p ? '' : ' one')}>
        {both.map((x) => (
          <div className="total-box" key={x.id}>
            <div className="label">{x.name}</div>
            <div className="value">
              <StarIcon size={17} /> {bnNum(x.points.total)}
            </div>
            <div className="tally">
              <span className="good">আজ {bnNum(x.points.today)} পয়েন্ট</span>
            </div>
          </div>
        ))}
      </div>

      {p ? <TouchCard partnerName={p.name} /> : null}

      {!p ? (
        <div className="empty-note" style={{ marginTop: 4 }}>
          এখনো জোড়া বাঁধেননি। সেটিংসে গিয়ে কোড দিয়ে জোড়া বাঁধলে এখানে দুজনের হিসাব পাশাপাশি দেখতে
          পাবেন। আপনার হিসাব শুধু আপনার সঙ্গীই দেখতে পাবেন, আর কেউ না।
        </div>
      ) : null}

      <div className="section-title">আজকের দিন</div>
      <div className="dash-table">
        {p ? (
          <div className="dash-row head">
            <div className="dash-label" />
            <div className="dash-side">{me.name}</div>
            <div className="dash-side">{p.name}</div>
          </div>
        ) : null}
        <Row label="নামাজ লেখা" a={me.today.namaz} b={p ? p.today.namaz : null} max={5} tone="good" unit="/৫" />
        <Row label="কুইজ সঠিক" a={me.today.quiz} b={p ? p.today.quiz : null} max={10} tone="gold" unit="/১০" />
        <Row label="দোয়া পড়া" a={me.today.dua} b={p ? p.today.dua : null} max={23} tone="pink" />
        <Row label="আমল করা" a={me.today.amol} b={p ? p.today.amol : null} max={20} tone="pink" />
      </div>

      <div className="section-title">কুরআন</div>
      <div className="dash-table">
        <Row
          label="পারা শেষ"
          a={me.quran.juzDone}
          b={p ? p.quran.juzDone : null}
          max={30}
          tone="good"
          unit="/৩০"
        />
        <Row
          label="আয়াত পড়া"
          a={me.quran.ayahs}
          b={p ? p.quran.ayahs : null}
          max={maxAyah}
          tone="good"
        />
      </div>

      <div className="section-title">এই মাসের নামাজ</div>
      <div className="dash-table">
        <Row
          label="জরিমানা"
          a={me.namaz.monthFine}
          b={p ? p.namaz.monthFine : null}
          max={maxFine}
          tone="bad"
          unit=" ৳"
        />
        <Row
          label="পড়েছে"
          a={me.namaz.monthCount.prayed}
          b={p ? p.namaz.monthCount.prayed : null}
          max={150}
          tone="good"
        />
        <Row
          label="কাজা"
          a={me.namaz.monthCount.qaza}
          b={p ? p.namaz.monthCount.qaza : null}
          max={150}
          tone="warn"
        />
        <Row
          label="পড়েনি"
          a={me.namaz.monthCount.missed}
          b={p ? p.namaz.monthCount.missed : null}
          max={150}
          tone="bad"
        />
      </div>

      <div className="section-title">মোট পয়েন্ট</div>
      <div className="dash-table">
        <Row label="সব মিলিয়ে" a={me.points.total} b={p ? p.points.total : null} max={maxPoints} tone="gold" />
      </div>

      <p className="month-foot">
        এই হিসাব শুধু আপনি আর আপনার সঙ্গী দেখতে পান। অন্য কোনো ব্যবহারকারী এটা দেখতে পায় না।
      </p>
    </main>
  );
}
