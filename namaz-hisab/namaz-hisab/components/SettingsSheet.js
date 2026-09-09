'use client';

import { useRef, useState } from 'react';
import Avatar from './Avatar';
import { STATUSES } from '../lib/prayers';
import { bnNum } from '../lib/store';

// ছবি ছোট করে নিই যাতে ব্রাউজার স্টোরেজে সহজে ধরে
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
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function PersonField({ label, person, onChange, onError }) {
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await shrinkImage(file);
      onChange({ ...person, photo: dataUrl });
    } catch (err) {
      onError('ছবিটা পড়া গেল না। অন্য একটা ছবি দিয়ে দেখুন।');
    }
  }

  return (
    <div className="field">
      <label htmlFor={'name-' + label}>{label}</label>
      <div className="photo-row">
        <Avatar person={person} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            id={'name-' + label}
            type="text"
            value={person.name}
            maxLength={18}
            placeholder="নাম লিখুন"
            onChange={(e) => onChange({ ...person, name: e.target.value })}
          />
          <div className="photo-actions" style={{ marginTop: 8 }}>
            <button type="button" className="mini-btn" onClick={() => inputRef.current.click()}>
              {person.photo ? 'ছবি বদলান' : 'ছবি দিন'}
            </button>
            {person.photo ? (
              <button
                type="button"
                className="mini-btn danger"
                onClick={() => onChange({ ...person, photo: '' })}
              >
                ছবি সরান
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
    </div>
  );
}

export default function SettingsSheet({
  people,
  soundOn,
  account,
  syncLabel,
  onToggleSound,
  onSave,
  onClose,
  onClearAll,
  onOpenAuth,
  onLogout,
  onError,
}) {
  const [draft, setDraft] = useState(people);
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className="sheet-bg"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label="সেটিংস">
        <h2>কে কে হিসাবে আছে</h2>
        <p className="hint">
          {account && account.user
            ? 'নাম আর ছবি আপনার অ্যাকাউন্টে জমা থাকে, তাই সব ডিভাইসে একই দেখাবে।'
            : 'নাম আর ছবি এই ফোনেই জমা থাকে, আর কোথাও যায় না।'}
        </p>

        <PersonField
          label="প্রথম জন"
          person={draft.p1}
          onChange={(p1) => setDraft({ ...draft, p1 })}
          onError={onError}
        />
        <PersonField
          label="দ্বিতীয় জন"
          person={draft.p2}
          onChange={(p2) => setDraft({ ...draft, p2 })}
          onError={onError}
        />

        <div className="section-title">জরিমানার নিয়ম</div>
        <div className="rules">
          {STATUSES.map((s) => (
            <div key={s.id}>
              <span>{s.bn}</span>
              <b>{s.fine === 0 ? 'কিছু নেই' : '৳ ' + bnNum(s.fine)}</b>
            </div>
          ))}
        </div>

        <button type="button" className="toggle-row" onClick={onToggleSound}>
          <span>প্রতিটি ট্যাপে শব্দ</span>
          <span className={'switch' + (soundOn ? ' on' : '')} aria-hidden="true">
            <span />
          </span>
        </button>

        {account && account.cloud ? (
          <>
            <div className="section-title">অ্যাকাউন্ট</div>
            {account.user ? (
              <div className="account-box">
                <div>
                  <b>{account.user.username}</b>
                  <small>{syncLabel}</small>
                </div>
                <button type="button" className="mini-btn danger" onClick={onLogout}>
                  লগআউট
                </button>
              </div>
            ) : (
              <div className="account-box">
                <div>
                  <b>লগইন করা নেই</b>
                  <small>হিসাব শুধু এই ডিভাইসে জমছে</small>
                </div>
                <button type="button" className="mini-btn" onClick={onOpenAuth}>
                  লগইন করুন
                </button>
              </div>
            )}
          </>
        ) : null}

        <button
          type="button"
          className="toggle-row"
          style={{ color: 'var(--bad)' }}
          onClick={() => {
            if (confirming) {
              onClearAll();
              setConfirming(false);
            } else {
              setConfirming(true);
            }
          }}
        >
          <span>{confirming ? 'সত্যিই সব হিসাব মুছে ফেলব?' : 'সব হিসাব মুছে ফেলুন'}</span>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            {confirming ? 'আবার চাপুন' : ''}
          </span>
        </button>

        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onClose}>
            বাতিল
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              const clean = {
                p1: { ...draft.p1, name: draft.p1.name.trim() || 'প্রথম জন' },
                p2: { ...draft.p2, name: draft.p2.name.trim() || 'দ্বিতীয় জন' },
              };
              onSave(clean);
            }}
          >
            সেভ করুন
          </button>
        </div>
      </div>
    </div>
  );
}
