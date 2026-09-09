'use client';

import { useState } from 'react';
import SettingsSheet from './SettingsSheet';
import { GearIcon } from './Icons';

// প্রতিটি পাতার উপরের অংশ — নাম, ছোট বর্ণনা, আর ডানে সেটিংস
export default function PageHead({ title, sub, right }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="pagehead">
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
      {open ? <SettingsSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}
