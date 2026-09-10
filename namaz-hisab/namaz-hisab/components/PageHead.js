'use client';

import { useState } from 'react';
import SettingsSheet from './SettingsSheet';
import { GearIcon } from './Icons';

// প্রতিটি পাতার উপরের অংশ — নাম, ছোট বর্ণনা, আর ডানে সেটিংস।
//
// সাজটা মুসহাফের পাতার ঢঙে: নামের পাশে মিহরাবের খিলান, নিচে দুই পাশে সরু
// রেখা আর মাঝখানে রুবউল হিজবের তারা (۞) — কুরআনের পাতায় যেভাবে পারার
// ভাগ চিহ্নিত করা হয়।
export default function PageHead({ title, sub, right }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="pagehead">
        <span className="head-arch" aria-hidden="true">
          <svg viewBox="0 0 40 52" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 3c9 0 15 6.6 15 15v30H5V18C5 9.6 11 3 20 3Z" opacity=".55" />
            <path d="M20 11c5 0 8.5 3.8 8.5 8.6V40h-17V19.6C11.5 14.8 15 11 20 11Z" opacity=".9" />
            <circle cx="20" cy="24" r="3" />
          </svg>
        </span>
        <div className="pagehead-text">
          <h1>{title}</h1>
          {sub ? <p>{sub}</p> : null}
        </div>
        <div className="icon-row">
          {right}
          <button
            type="button"
            className="icon-btn"
            onClick={() => setOpen(true)}
            aria-label="সেটিংস"
          >
            <GearIcon />
          </button>
        </div>
      </div>

      <div className="head-rule" aria-hidden="true">
        <i />
        <span>۞</span>
        <i />
      </div>

      {open ? <SettingsSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}
