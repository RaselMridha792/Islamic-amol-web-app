'use client';

import { CheckIcon, ClockIcon, CrossIcon, LampIcon } from './Icons';

const MARKS = {
  good: <CheckIcon />,
  warn: <ClockIcon />,
  bad: <CrossIcon />,
  info: <LampIcon />,
};

export default function ToastStack({ toasts }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={'toast ' + t.tone + (t.leaving ? ' out' : '')}>
          <div className="mark">{MARKS[t.tone] || MARKS.info}</div>
          <div>
            <div className="title">{t.title}</div>
            {t.body ? <div className="body">{t.body}</div> : null}
          </div>
          {t.amount ? <div className="amount">{t.amount}</div> : null}
        </div>
      ))}
    </div>
  );
}
