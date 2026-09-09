'use client';

import { useState } from 'react';

export default function AuthSheet({ onLogin, onRegister, onClose }) {
  const [mode, setMode] = useState('login');
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
      if (isNew) await onRegister(username, password);
      else await onLogin(username, password);
    } catch (err) {
      setError(err.message || 'কিছু একটা ভুল হলো');
      setBusy(false);
    }
  }

  return (
    <div
      className="sheet-bg"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label="অ্যাকাউন্ট">
        <h2>{isNew ? 'নতুন অ্যাকাউন্ট' : 'লগইন করুন'}</h2>
        <p className="hint">
          অ্যাকাউন্ট থাকলে ফোন আর ল্যাপটপ — সব জায়গায় একই হিসাব দেখবেন। না করলেও অ্যাপ এই ফোনে
          আগের মতোই চলবে।
        </p>

        <div className="who-tabs" style={{ marginTop: 4 }}>
          <button
            type="button"
            className={'who-tab' + (!isNew ? ' on' : '')}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            লগইন
          </button>
          <button
            type="button"
            className={'who-tab' + (isNew ? ' on' : '')}
            onClick={() => {
              setMode('register');
              setError('');
            }}
          >
            নতুন অ্যাকাউন্ট
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="nh-user">ইউজারনেম</label>
            <input
              id="nh-user"
              type="text"
              value={username}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              maxLength={24}
              placeholder="যেমন mirza"
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="nh-pass">পাসওয়ার্ড</label>
            <input
              id="nh-pass"
              type="password"
              value={password}
              autoComplete={isNew ? 'new-password' : 'current-password'}
              maxLength={200}
              placeholder={isNew ? 'অন্তত ৬ অক্ষর' : 'পাসওয়ার্ড'}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error ? <div className="auth-error">{error}</div> : null}

          <div className="sheet-actions">
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              এখন নয়
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'অপেক্ষা করুন…' : isNew ? 'অ্যাকাউন্ট খুলুন' : 'লগইন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
