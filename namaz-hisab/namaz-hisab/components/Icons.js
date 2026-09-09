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
