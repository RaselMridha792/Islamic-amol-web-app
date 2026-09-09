let ctx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function note(freq, startAfter, duration, type, peak) {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const t = audio.currentTime + startAfter;

  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t);

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak || 0.12, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

const PATTERNS = {
  // পড়েছে: উপরের দিকে ওঠা নরম তিন সুর
  prayed: () => {
    note(659.25, 0, 0.18, 'sine', 0.12);
    note(830.61, 0.08, 0.2, 'sine', 0.1);
    note(987.77, 0.16, 0.32, 'sine', 0.09);
  },
  // কাজা: মাঝারি দুই সুর
  qaza: () => {
    note(523.25, 0, 0.16, 'triangle', 0.11);
    note(466.16, 0.11, 0.26, 'triangle', 0.1);
  },
  // পড়েনি: নিচু দুই সুর
  missed: () => {
    note(261.63, 0, 0.18, 'sawtooth', 0.06);
    note(196.0, 0.12, 0.3, 'sine', 0.11);
  },
  // মুছে ফেলা
  clear: () => {
    note(392.0, 0, 0.12, 'sine', 0.08);
  },
  // সেভ / সাধারণ ট্যাপ
  save: () => {
    note(587.33, 0, 0.12, 'sine', 0.1);
    note(880.0, 0.09, 0.22, 'sine', 0.08);
  },
};

export function playSound(kind, enabled) {
  if (!enabled) return;
  const fn = PATTERNS[kind];
  if (fn) {
    try {
      fn();
    } catch (err) {
      // অডিও না চললে অ্যাপ থামবে না
    }
  }
}

// প্রথম ট্যাপে ব্রাউজারের অডিও আনলক করার জন্য
export function warmUpAudio() {
  getCtx();
}
