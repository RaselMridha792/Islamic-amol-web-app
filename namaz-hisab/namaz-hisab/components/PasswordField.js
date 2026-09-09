'use client';

import { useState } from 'react';
import { EyeIcon, EyeOffIcon } from './Icons';

// পাসওয়ার্ডের ঘর, পাশে চোখের বোতাম — লিখতে গিয়ে ভুল হলে দেখে নেওয়া যায়
export default function PasswordField({ id, label, value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pass-wrap">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck="false"
          maxLength={200}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="pass-eye"
          aria-label={show ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখান'}
          aria-pressed={show}
          onClick={() => setShow((v) => !v)}
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}
