'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Avatar from './Avatar';
import { useAuth } from './AuthProvider';
import { STATUSES } from '../lib/prayers';
import { POINTS } from '../lib/points';
import { bnNum, loadSoundOn, saveSoundOn } from '../lib/store';
import { getPair, joinPair, makePairCode, unpair } from '../lib/cloud';
import { LinkIcon } from './Icons';
import InstallButton from './InstallButton';
import { currentSubscription, disablePush, enablePush, pushSupported, testPush } from '../lib/pushClient';
import { CITIES, DEFAULT_PLACE, hhmm, timesFor } from '../lib/prayerTimes';

// ছবি ছোট করে নিই যাতে সহজে জমা থাকে
function shrinkImage(file, max = 260) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode-failed'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- জোড়া বাঁধার অংশ ---------- */

function PairBox({ onChanged }) {
  const [state, setState] = useState({ loading: true, partner: null, code: null });
  const [entry, setEntry] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    try {
      const res = await getPair();
      setState({ loading: false, partner: res.partner, code: res.code });
    } catch (err) {
      setState({ loading: false, partner: null, code: null });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function run(fn) {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      await load();
      if (onChanged) onChanged();
    } catch (err) {
      setMsg(err.message || 'কাজটা হলো না');
    }
    setBusy(false);
  }

  if (state.loading) return <div className="empty-note">দেখা হচ্ছে…</div>;

  if (state.partner) {
    return (
      <div className="account-box">
        <div>
          <b>{state.partner.name}</b>
          <small>আপনারা জোড়া বাঁধা — একে অপরের হিসাব দেখতে পান</small>
        </div>
        <button
          type="button"
          className="mini-btn danger"
          disabled={busy}
          onClick={() => run(unpair)}
        >
          খুলে দিন
        </button>
      </div>
    );
  }

  return (
    <div className="pair-box">
      <p className="hint" style={{ marginTop: 0 }}>
        একজন কোড বানাবেন, অন্যজন সেই কোডটা লিখবেন। জোড়া বাঁধলে শুধু আপনারা দুজনই একে
        অপরের হিসাব দেখতে পাবেন — আর কেউ না।
      </p>

      {state.code ? (
        <div className="pair-code">
          <span>{state.code}</span>
          <small>সঙ্গীকে এই কোডটা দিন · ২৪ ঘণ্টা চলবে</small>
        </div>
      ) : (
        <button
          type="button"
          className="btn wide"
          disabled={busy}
          onClick={() => run(makePairCode)}
        >
          <LinkIcon /> আমার কোড বানান
        </button>
      )}

      <div className="pair-or">অথবা</div>

      <div className="field">
        <label htmlFor="pair-code">সঙ্গীর কোড</label>
        <input
          id="pair-code"
          type="text"
          value={entry}
          maxLength={8}
          placeholder="৬ অক্ষরের কোড"
          autoCapitalize="characters"
          spellCheck="false"
          onChange={(e) => setEntry(e.target.value.toUpperCase())}
        />
      </div>
      <button
        type="button"
        className="btn primary wide"
        disabled={busy || entry.length < 6}
        onClick={() => run(() => joinPair(entry))}
      >
        জোড়া বাঁধুন
      </button>

      {msg ? <div className="auth-error">{msg}</div> : null}
    </div>
  );
}

/* ---------- পুরো শিট ---------- */

export default function SettingsSheet({ onClose }) {
  const { user, logout, refresh } = useAuth();
  const [name, setName] = useState(user ? user.name || user.username : '');
  const [photo, setPhoto] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  const [hardQuiz, setHardQuiz] = useState(false);
  const [push, setPush] = useState({ can: false, on: false, busy: false });
  const [city, setCity] = useState(DEFAULT_PLACE.city);
  const [notifyPrayer, setNotifyPrayer] = useState(false);
  const [notifyQuran, setNotifyQuran] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [mounted, setMounted] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    setSoundOn(loadSoundOn());
    if (pushSupported()) {
      currentSubscription()
        .then((sub) => setPush({ can: true, on: Boolean(sub), busy: false }))
        .catch(() => setPush({ can: true, on: false, busy: false }));
    }
    fetch('/api/profile', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) {
          setName(d.name || '');
          setPhoto(d.photo || '');
          setHardQuiz(Boolean(d.hardQuiz));
          setCity(d.city || DEFAULT_PLACE.city);
          setNotifyPrayer(Boolean(d.notifyPrayer));
          setNotifyQuran(Boolean(d.notifyQuran));
        }
      })
      .catch(() => {});
  }, []);

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhoto(await shrinkImage(file));
    } catch (err) {
      setMsg('ছবিটা পড়া গেল না, অন্য একটা দিয়ে দেখুন');
    }
  }

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          photo,
          hardQuiz,
          city,
          lat: place.lat,
          lng: place.lng,
          notifyPrayer,
          notifyQuran,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'সেভ হলো না');
      await refresh();
      onClose();
    } catch (err) {
      setMsg(err.message);
      setSaving(false);
    }
  }

  async function togglePush() {
    if (push.busy) return;
    setPush((p) => ({ ...p, busy: true }));
    setMsg('');
    try {
      if (push.on) {
        await disablePush();
        setPush({ can: true, on: false, busy: false });
      } else {
        await enablePush();
        setPush({ can: true, on: true, busy: false });
        await testPush().catch(() => {});
      }
    } catch (err) {
      setPush((p) => ({ ...p, busy: false }));
      setMsg(err.message || 'নোটিফিকেশন চালু করা গেল না');
    }
  }

  const place = CITIES.find((c) => c.city === city) || DEFAULT_PLACE;
  // আজকের সময়গুলো দেখিয়ে দিই, যাতে ঠিক শহর বেছেছেন কিনা বোঝা যায়
  const today = timesFor(place.lat, place.lng);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    saveSoundOn(next);
  }

  // শিটটা পাতার ভেতরে থাকলে .shell এর স্ট্যাকিং কনটেক্সটে আটকে যায়, আর নিচের
  // ট্যাববার তার উপরে উঠে আসে। তাই সরাসরি body তে বসাই।
  if (!mounted) return null;

  return createPortal(
    <div
      className="sheet-bg"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label="সেটিংস">
        <h2>আপনার তথ্য</h2>

        <div className="sheet-body">
        <div className="field">
          <label htmlFor="me-name">নাম</label>
          <div className="photo-row">
            <Avatar person={{ name, photo }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                id="me-name"
                type="text"
                value={name}
                maxLength={24}
                placeholder="আপনার নাম"
                onChange={(e) => setName(e.target.value)}
              />
              <div className="photo-actions" style={{ marginTop: 8 }}>
                <button type="button" className="mini-btn" onClick={() => fileRef.current.click()}>
                  {photo ? 'ছবি বদলান' : 'ছবি দিন'}
                </button>
                {photo ? (
                  <button type="button" className="mini-btn danger" onClick={() => setPhoto('')}>
                    ছবি সরান
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
        </div>

        <div className="section-title">সঙ্গী</div>
        <PairBox onChanged={refresh} />

        <div className="section-title">পয়েন্টের নিয়ম</div>
        <div className="rules">
          <div><span>কুইজের প্রতিটি সঠিক উত্তর</span><b>{bnNum(POINTS.quiz)}</b></div>
          <div><span>একটি দোয়া পড়া</span><b>{bnNum(POINTS.dua)}</b></div>
          <div><span>একটি আমল করা</span><b>{bnNum(POINTS.amol)}</b></div>
        </div>

        <div className="section-title">নামাজের জরিমানা</div>
        <div className="rules">
          {STATUSES.map((s) => (
            <div key={s.id}>
              <span>{s.bn}</span>
              <b>{s.fine === 0 ? 'কিছু নেই' : '৳ ' + bnNum(s.fine)}</b>
            </div>
          ))}
        </div>

        <div className="section-title">নোটিফিকেশন ও অ্যাপ</div>

        {push.can ? (
          <>
            <button type="button" className="toggle-row" onClick={togglePush} disabled={push.busy}>
              <span>
                এই ডিভাইসে নোটিফিকেশন
                <small>আগে এটা চালু করতে হবে</small>
              </span>
              <span className={'switch' + (push.on ? ' on' : '')} aria-hidden="true">
                <span />
              </span>
            </button>

            <button
              type="button"
              className="toggle-row"
              disabled={!push.on}
              onClick={() => setNotifyPrayer((v) => !v)}
            >
              <span>
                প্রতি ওয়াক্তের সময়
                <small>ফজর, যোহর, আসর, মাগরিব, এশা — সময় হলেই</small>
              </span>
              <span className={'switch' + (notifyPrayer ? ' on' : '')} aria-hidden="true">
                <span />
              </span>
            </button>

            <button
              type="button"
              className="toggle-row"
              disabled={!push.on}
              onClick={() => setNotifyQuran((v) => !v)}
            >
              <span>
                ফজরের পর কুরআন
                <small>ফজরের ২৫ মিনিট পর মনে করিয়ে দেবে</small>
              </span>
              <span className={'switch' + (notifyQuran ? ' on' : '')} aria-hidden="true">
                <span />
              </span>
            </button>

            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="city">আপনার শহর</label>
              <div className="qari-pick" style={{ marginBottom: 8 }}>
                <span>শহর</span>
                <select id="city" value={city} onChange={(e) => setCity(e.target.value)}>
                  {CITIES.map((c) => (
                    <option key={c.city} value={c.city}>{c.city}</option>
                  ))}
                </select>
              </div>
              <div className="times-row">
                {[['ফজর', today.fajr], ['যোহর', today.dhuhr], ['আসর', today.asr],
                  ['মাগরিব', today.maghrib], ['এশা', today.isha]].map(([n, t]) => (
                  <span key={n}><b>{n}</b>{hhmm(t)}</span>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="empty-note" style={{ textAlign: 'left', fontSize: 12.5 }}>
            এই ব্রাউজারে নোটিফিকেশন চলে না। আইফোনে আগে হোম স্ক্রিনে অ্যাড করে নিলে চলবে।
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <InstallButton />
        </div>

        <div className="section-title">কুইজ</div>
        <button
          type="button"
          className="toggle-row"
          onClick={() => setHardQuiz((v) => !v)}
        >
          <span>
            কঠিন প্রশ্নও দিন
            <small>হাদিসের বর্ণনাকারী ও শূন্যস্থান — আলিমদের মতো কঠিন</small>
          </span>
          <span className={'switch' + (hardQuiz ? ' on' : '')} aria-hidden="true">
            <span />
          </span>
        </button>

        <button type="button" className="toggle-row" onClick={toggleSound}>
          <span>প্রতিটি ট্যাপে শব্দ</span>
          <span className={'switch' + (soundOn ? ' on' : '')} aria-hidden="true">
            <span />
          </span>
        </button>

        <button
          type="button"
          className="toggle-row"
          style={{ color: 'var(--bad)' }}
          onClick={logout}
        >
          <span>লগআউট</span>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            {user ? user.username : ''}
          </span>
        </button>

        {msg ? <div className="auth-error">{msg}</div> : null}
        </div>

        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onClose}>
            বাতিল
          </button>
          <button type="button" className="btn primary" onClick={save} disabled={saving}>
            {saving ? 'সেভ হচ্ছে…' : 'সেভ করুন'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
