export function CrescentIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16.8 15.6A6.6 6.6 0 0 1 9.6 5.1a7.2 7.2 0 1 0 9.1 9.1c-.6.3-1.2.4-1.9.4Z"
        fill="#fff"
      />
      <path d="m18.9 4.4.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" fill="#ffd9e6" />
    </svg>
  );
}

export function MosqueIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M12 3c2.4 1.8 3.6 3.4 3.6 5 0 1.3-1.2 2.4-3.6 3-2.4-.6-3.6-1.7-3.6-3 0-1.6 1.2-3.2 3.6-5Z" />
      <path d="M5 21v-6a3.4 3.4 0 0 1 3.4-3.4h7.2A3.4 3.4 0 0 1 19 15v6" strokeLinecap="round" />
      <path d="M9.6 21v-3.2a2.4 2.4 0 0 1 4.8 0V21" strokeLinecap="round" />
    </svg>
  );
}

export function GearIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 14a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.5 1v.3a1.8 1.8 0 1 1-3.6 0v-.2a1.5 1.5 0 0 0-2.6-1l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1-2.5H4.5a1.8 1.8 0 1 1 0-3.6h.2a1.5 1.5 0 0 0 1-2.6l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 2.5-1V4.5a1.8 1.8 0 1 1 3.6 0v.2a1.5 1.5 0 0 0 2.5 1l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0 1 2.5h.3a1.8 1.8 0 1 1 0 3.6h-.2a1.5 1.5 0 0 0-1.2.6Z" />
    </svg>
  );
}

export function SoundOnIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6.5 8.7H3.6v6.6h2.9L11 19V5Z" />
      <path d="M15.5 9.2a4 4 0 0 1 0 5.6M18.3 6.6a7.8 7.8 0 0 1 0 10.8" />
    </svg>
  );
}

export function SoundOffIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6.5 8.7H3.6v6.6h2.9L11 19V5Z" />
      <path d="m16 9.5 4.5 5M20.5 9.5 16 14.5" />
    </svg>
  );
}

export function ChevronIcon({ dir = 'left', size = 18 }) {
  const d = dir === 'left' ? 'm14.5 5-6 7 6 7' : 'm9.5 5 6 7-6 7';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function CheckIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function ClockIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function CrossIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
    </svg>
  );
}

export function CoinIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9h4a2 2 0 0 1 0 4h-4M9.5 13h5M12 7v10" />
    </svg>
  );
}

export function LampIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5v2" />
      <path d="M8 6h8l-1.4 3.2A5.5 5.5 0 0 1 17 14c0 2.8-2.2 4.6-5 4.6S7 16.8 7 14a5.5 5.5 0 0 1 2.4-4.8L8 6Z" />
      <path d="M12 18.6v2.9" />
    </svg>
  );
}

export function CloudIcon({ size = 18, state = 'off' }) {
  // state: off | syncing | ok | error
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 18.5a4 4 0 0 1-.4-8 5.4 5.4 0 0 1 10.3-1.2A3.9 3.9 0 0 1 17.6 18.5H7Z" />
      {state === 'ok' ? <path d="m9.6 13.6 1.8 1.8 3.4-3.8" /> : null}
      {state === 'error' ? <path d="M12 9.4v3.1M12 15.4v.05" /> : null}
      {state === 'syncing' ? <path d="M12 10.2v3l1.9 1.1" /> : null}
      {state === 'off' ? <path d="m5 5 14 14" strokeWidth="1.7" /> : null}
    </svg>
  );
}

export function BookIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4.8A1.8 1.8 0 0 1 5.8 3H10a2.5 2.5 0 0 1 2 1 2.5 2.5 0 0 1 2-1h4.2A1.8 1.8 0 0 1 20 4.8v12.4a1.8 1.8 0 0 1-1.8 1.8H14a2.5 2.5 0 0 0-2 1 2.5 2.5 0 0 0-2-1H5.8A1.8 1.8 0 0 1 4 17.2V4.8Z" />
      <path d="M12 5v14" />
    </svg>
  );
}

export function QuizIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.6" />
      <path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2-2.4 3.4" />
      <path d="M12 16.8v.05" />
    </svg>
  );
}

export function HandsIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8.6 20.5c-2.2-1-3.6-3-3.6-5.5V9.2a1.3 1.3 0 0 1 2.6 0v3" />
      <path d="M15.4 20.5c2.2-1 3.6-3 3.6-5.5V9.2a1.3 1.3 0 0 0-2.6 0v3" />
      <path d="M9.6 12V4.8a1.3 1.3 0 0 1 2.6 0V11M12.2 11V5.6a1.3 1.3 0 0 1 2.6 0V12" />
    </svg>
  );
}

export function UsersIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c.6-2.9 2.8-4.6 5.5-4.6s4.9 1.7 5.5 4.6" />
      <path d="M16.2 6.1a3.2 3.2 0 0 1 .3 6M17.6 15.4c2 .5 3.4 2 3.9 4.1" />
    </svg>
  );
}

export function LinkIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5" />
      <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5" />
    </svg>
  );
}

export function StarIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3.6 2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16.6l-5.2 2.9L8 13.7l-4.4-4 5.9-.7L12 3.6Z" />
    </svg>
  );
}

export function PlayIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.6c0-.8.9-1.3 1.6-.9l8 6.4c.6.4.6 1.4 0 1.8l-8 6.4c-.7.4-1.6-.1-1.6-.9V5.6Z" />
    </svg>
  );
}

export function PauseIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="7" y="5" width="3.6" height="14" rx="1.2" />
      <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
    </svg>
  );
}

export function SpinIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className="spin">
      <path d="M12 3.5a8.5 8.5 0 1 1-6 2.5" />
    </svg>
  );
}

export function EyeIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.9 5.8A8.6 8.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.9 3.7M6.4 6.9A16 16 0 0 0 2.5 12S6 18.5 12 18.5c1.3 0 2.4-.3 3.4-.7" />
      <path d="M10 10a2.8 2.8 0 0 0 4 4" />
      <path d="m4 4 16 16" />
    </svg>
  );
}
