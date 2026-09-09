'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from './AuthProvider';
import {
  BookIcon,
  CrescentIcon,
  HandsIcon,
  MosqueIcon,
  QuizIcon,
  UsersIcon,
} from './Icons';

const TABS = [
  { href: '/', label: 'নামাজ', Icon: MosqueIcon },
  { href: '/quran', label: 'কুরআন', Icon: BookIcon },
  { href: '/quiz', label: 'কুইজ', Icon: QuizIcon },
  { href: '/amol', label: 'আমল', Icon: HandsIcon },
  { href: '/dashboard', label: 'আমরা', Icon: UsersIcon },
];

function Brand({ big }) {
  return (
    <div className={'brand' + (big ? ' brand-big' : '')}>
      <div className="crescent">
        <CrescentIcon size={big ? 30 : 20} />
      </div>
      <div className="brand-name">
        <h1>একসাথে দ্বীনের পথে</h1>
        <p>DeenTogether</p>
      </div>
    </div>
  );
}

/* ---------- ঢোকার মুখে লগইন ---------- */

function Gate() {
  const { login, register, cloud } = useAuth();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isNew = mode === 'register';

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (isNew) await register(username, password, name);
      else await login(username, password);
    } catch (err) {
      setError(err.message || 'কিছু একটা ভুল হলো');
      setBusy(false);
    }
  }

  return (
    <main className="gate">
      <Brand big />

      <p className="gate-lead">
        নামাজ, কুরআন, দোয়া আর ছোট ছোট আমল — দুজনে মিলে এক খাতায়।
      </p>

      {!cloud ? (
        <div className="empty-note" style={{ marginTop: 20 }}>
          সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।
        </div>
      ) : (
        <form className="gate-card" onSubmit={submit}>
          <div className="who-tabs">
            <button
              type="button"
              className={'who-tab' + (!isNew ? ' on' : '')}
              onClick={() => { setMode('login'); setError(''); }}
            >
              লগইন
            </button>
            <button
              type="button"
              className={'who-tab' + (isNew ? ' on' : '')}
              onClick={() => { setMode('register'); setError(''); }}
            >
              নতুন অ্যাকাউন্ট
            </button>
          </div>

          {isNew ? (
            <div className="field">
              <label htmlFor="g-name">আপনার নাম</label>
              <input
                id="g-name"
                type="text"
                value={name}
                maxLength={24}
                placeholder="যে নামে সঙ্গী চিনবে"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="g-user">ইউজারনেম</label>
            <input
              id="g-user"
              type="text"
              value={username}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              maxLength={24}
              placeholder="ইংরেজিতে, যেমন mirza"
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="g-pass">পাসওয়ার্ড</label>
            <input
              id="g-pass"
              type="password"
              value={password}
              autoComplete={isNew ? 'new-password' : 'current-password'}
              maxLength={200}
              placeholder={isNew ? 'অন্তত ৬ অক্ষর' : 'পাসওয়ার্ড'}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error ? <div className="auth-error">{error}</div> : null}

          <button type="submit" className="btn primary wide" disabled={busy}>
            {busy ? 'অপেক্ষা করুন…' : isNew ? 'অ্যাকাউন্ট খুলুন' : 'ঢুকুন'}
          </button>
        </form>
      )}

      <p className="gate-foot">
        <span className="ar">إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا</span>
        নিশ্চয়ই নামাজ মুমিনদের উপর নির্দিষ্ট সময়ে ফরজ
      </p>
    </main>
  );
}

/* ---------- নিচের ট্যাব ---------- */

function BottomNav() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="প্রধান মেনু">
      {TABS.map(({ href, label, Icon }) => {
        const on = href === '/' ? path === '/' : path.startsWith(href);
        return (
          <Link key={href} href={href} className={'tab' + (on ? ' on' : '')}>
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppShell({ children }) {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <main className="shell">
        <div className="empty-note" style={{ marginTop: 60 }}>
          খাতা খোলা হচ্ছে…
        </div>
      </main>
    );
  }

  if (!user) return <Gate />;

  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}

export { Brand };
