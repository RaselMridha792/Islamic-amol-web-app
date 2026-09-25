'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HeartIcon } from './Icons';
import { TOUCH_COLORS, UNIT, createPainter } from '../lib/touch';
import { endDraw, endDrawBeacon, sendDrawPart, startDraw } from '../lib/cloud';

// সঙ্গীর স্ক্রিনে আঁকার খাতা — পুরো পর্দা জুড়ে।
//
// আঁকার সাথে সাথে বিন্দুগুলো জমতে থাকে, আর একটু পরপর টুকরো করে সার্ভারে
// যায়। একবারে একটাই টুকরো পথে থাকে — আগেরটা পৌঁছানোর পরেই পরেরটা, যাতে
// ক্রম কখনো উল্টে না যায় (নইলে দেখার দিকে একটা টুকরো বাদ পড়ে যেতে পারত)।
// নেট ধীর হলে টুকরো বড় হয়, দ্রুত হলে ছোট — নিজে থেকেই মানিয়ে নেয়।

const TICK = 120;           // কত পরপর পাঠানোর চেষ্টা (ms)
const IDLE_END = 12000;     // এতক্ষণ কিছু না আঁকলে এই পর্ব শেষ; আবার আঁকলে নতুন করে জানানো হয়
const MIN_STEP = 3;         // এর চেয়ে কাছের বিন্দু বাদ — আঁকা একই থাকে, পাঠানো কমে

const COLOR_NAMES = ['গোলাপি', 'সোনালি', 'সাদা', 'সবুজ', 'আকাশি'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function DrawPad({ partner, onClose }) {
  const canvasRef = useRef(null);
  const painterRef = useRef(null);
  const colorRef = useRef(0);
  const [color, setColor] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState({
    tone: '',
    text: `আঁকা শুরু করুন — সাথে সাথে ${partner}-এর স্ক্রিনে যাবে`,
  });
  const st = useRef({
    id: null,          // চলতি পর্বের নম্বর (সার্ভারের)
    starting: false,
    seq: 0,
    buf: [],           // এখনো না-পাঠানো অংশ
    retry: null,       // যে টুকরো পৌঁছায়নি, আবার পাঠাতে হবে
    inFlight: false,
    fails: 0,
    k: 0,              // দাগের নম্বর
    down: false,
    lastPt: null,
    lastAt: 0,
    stopped: false,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // খাতা বসানো, পর্দা ঘুরলে আবার মাপা
  useEffect(() => {
    if (!mounted) return undefined;
    const c = canvasRef.current;
    const p = createPainter(c);
    p.setAspect(c.clientHeight / c.clientWidth);
    painterRef.current = p;
    const onResize = () => p.setAspect(c.clientHeight / c.clientWidth);
    window.addEventListener('resize', onResize);
    // খাতা খোলা থাকতে পেছনের পাতা যেন গড়িয়ে না যায়
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('resize', onResize);
      document.body.style.overflow = before;
    };
  }, [mounted]);

  // পাতা বন্ধ হয়ে গেলে বা খাতা সরে গেলে পর্বটা শেষ জানিয়ে দিই
  useEffect(() => {
    const bye = () => {
      if (st.current.id) endDrawBeacon(st.current.id);
    };
    window.addEventListener('pagehide', bye);
    return () => {
      window.removeEventListener('pagehide', bye);
      if (st.current.id && !st.current.stopped) endDraw(st.current.id).catch(() => {});
    };
  }, []);

  function stop(text) {
    st.current.stopped = true;
    st.current.buf = [];
    st.current.retry = null;
    setStatus({ tone: 'bad', text });
  }

  async function begin() {
    const s = st.current;
    s.starting = true;
    setStatus({ tone: 'wait', text: `${partner}-কে জানানো হচ্ছে…` });
    try {
      const c = canvasRef.current;
      const res = await startDraw(c.clientHeight / c.clientWidth);
      s.id = res.id;
      s.seq = 0;
      if (res.sent > 0) {
        setStatus({ tone: 'live', text: `${partner}-এর স্ক্রিনে যাচ্ছে` });
      } else {
        setStatus({
          tone: 'warn',
          text: `${partner}-এর ফোনে নোটিফিকেশন পৌঁছাচ্ছে না — ১৫ মিনিটের মধ্যে অ্যাপ খুললে দেখবেন`,
        });
      }
    } catch (err) {
      stop(err.message || 'পাঠানো গেল না');
    }
    s.starting = false;
  }

  async function tick() {
    const s = st.current;
    if (s.stopped || s.inFlight || s.starting) return;

    // অনেকক্ষণ চুপ — এই পর্ব শেষ; পরের দাগে নতুন করে জানানো হবে
    if (s.id && !s.down && !s.buf.length && !s.retry && Date.now() - s.lastAt > IDLE_END) {
      const id = s.id;
      s.id = null;
      endDraw(id).catch(() => {});
      setStatus({ tone: '', text: 'আবার আঁকলে নতুন করে জানানো হবে' });
      return;
    }

    if (!s.id) {
      if (s.buf.some((x) => !x.x)) begin();
      return;
    }

    let part = s.retry;
    if (!part) {
      if (!s.buf.length) return;
      s.seq += 1;
      part = { seq: s.seq, data: s.buf };
      s.buf = [];
    }
    s.inFlight = true;
    try {
      await sendDrawPart(s.id, part.seq, part.data);
      s.retry = null;
      s.fails = 0;
    } catch (err) {
      s.retry = part;
      s.fails += 1;
      if (err.status === 400 || err.status === 403 || s.fails >= 6) {
        stop(err.message || 'পাঠানো গেল না — নেট দেখে আবার খুলুন');
      }
    }
    s.inFlight = false;
  }

  // tick শুধু ref থেকে পড়ে, তাই একবার বসালেই হয়
  useEffect(() => {
    const t = setInterval(tick, TICK);
    return () => clearInterval(t);
  }, []);

  function units(e) {
    const r = canvasRef.current.getBoundingClientRect();
    const scale = r.width / UNIT;
    return [Math.round((e.clientX - r.left) / scale), Math.round((e.clientY - r.top) / scale)];
  }

  function add([x, y]) {
    const s = st.current;
    if (s.lastPt && Math.hypot(x - s.lastPt[0], y - s.lastPt[1]) < MIN_STEP) return;
    s.lastPt = [x, y];
    s.lastAt = Date.now();
    const c = colorRef.current;
    painterRef.current.apply({ k: s.k, c, x, y });
    if (s.stopped) return;
    const tail = s.buf[s.buf.length - 1];
    if (tail && tail.k === s.k && tail.c === c) tail.p.push(x, y);
    else s.buf.push({ k: s.k, c, p: [x, y] });
  }

  function onDown(e) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const s = st.current;
    s.k += 1;
    s.down = true;
    s.lastPt = null;
    add(units(e));
  }

  function onMove(e) {
    if (!st.current.down) return;
    // আঙুল দ্রুত নড়লে ব্রাউজার মাঝের বিন্দুগুলো একসাথে দেয় — সেগুলোও নিই,
    // নইলে দ্রুত টানা দাগ কোণাকুণি ভাঙা দেখায়
    const all = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    (all.length ? all : [e]).forEach((ev) => add(units(ev)));
  }

  function onUp() {
    st.current.down = false;
    st.current.lastAt = Date.now();
  }

  function pick(i) {
    colorRef.current = i;
    setColor(i);
  }

  function clearAll() {
    painterRef.current.apply({ clear: true });
    const s = st.current;
    // পর্ব চালু থাকলে ওদিকেও মুছে দিই; না থাকলে না-পাঠানোগুলো ফেলে দিলেই হলো
    if (s.id && !s.stopped) s.buf.push({ x: 1 });
    else s.buf = [];
  }

  async function finish() {
    const s = st.current;
    const id = s.id;
    s.stopped = true;
    if (id) {
      // পথে থাকা টুকরোটা আগে পৌঁছাক, তারপর বাকিটা — ক্রম যেন না ভাঙে
      for (let i = 0; i < 20 && s.inFlight; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(100);
      }
      try {
        if (s.retry) await sendDrawPart(id, s.retry.seq, s.retry.data);
        if (s.buf.length) await sendDrawPart(id, s.seq + 1, s.buf);
      } catch (err) {
        // শেষ টুকরোটা না গেলেও আঁকার বাকিটা তো পৌঁছে গেছে
      }
      s.id = null;
      endDraw(id).catch(() => {});
    }
    onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <div className="draw-pad" role="dialog" aria-modal="true" aria-label={`${partner}-এর স্ক্রিনে আঁকা`}>
      <div className="draw-top">
        <span className={'draw-dot ' + status.tone} aria-hidden="true" />
        <div className="draw-status">
          <b>
            <HeartIcon size={14} filled /> {partner}-এর স্ক্রিনে আঁকছেন
          </b>
          <small>{status.text}</small>
        </div>
        <button type="button" className="draw-done" onClick={finish}>
          শেষ
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="draw-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />

      <div className="draw-tools">
        {TOUCH_COLORS.map((c, i) => (
          <button
            key={c}
            type="button"
            className={'swatch' + (i === color ? ' on' : '')}
            style={{ background: c }}
            aria-label={COLOR_NAMES[i]}
            aria-pressed={i === color}
            onClick={() => pick(i)}
          />
        ))}
        <button type="button" className="mini-btn" onClick={clearAll}>
          মুছুন
        </button>
      </div>
    </div>,
    document.body
  );
}
