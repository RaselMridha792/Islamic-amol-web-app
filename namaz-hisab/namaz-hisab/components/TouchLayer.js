'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CrossIcon, HeartIcon } from './Icons';
import { createPainter, partOps } from '../lib/touch';
import { getPendingTouch, getTouch } from '../lib/cloud';

// সঙ্গী যা আঁকছেন, তা এই পাতার উপরেই ফুটে ওঠে — অ্যাপের যেকোনো পাতায়।
// ফোন কাঁপানোর ডাকও এখানেই ধরা হয়।
//
// খবর আসে তিন পথে:
//   ১. অ্যাপ সামনে খোলা — পুশ এলে সার্ভিস ওয়ার্কার এই পাতাকে জানায়
//   ২. নোটিফিকেশনে চাপ দিয়ে এলে — ঠিকানায় ?touch= বা ?buzz= থাকে
//   ৩. পুশ কোনো কারণে না পৌঁছালে — অ্যাপ সামনে এলেই একবার খোঁজ নিই
//
// আঁকার উপর দিয়েও পাতায় চাপ দেওয়া যায়, শুধু ✕ বোতামটা ধরা যায় —
// সঙ্গীর আঁকা যেন কখনো অ্যাপ চালাতে বাধা না দেয়।

const POLL = 300;         // আঁকা চলাকালীন কত পরপর নতুন টুকরো আনি (ms)
const HOLD = 5000;        // আঁকা শেষ হলে এতক্ষণ থাকে, তারপর মিলিয়ে যায়
const QUIET = 30000;      // এতক্ষণ নতুন কিছু না এলে ধরে নিই আঁকা থেমে গেছে
const BUZZ_SHOW = 2800;
const CHECK_GAP = 15000;  // অ্যাপ সামনে এলে খোঁজ — এর চেয়ে ঘন ঘন নয়

const BUZZ_PATTERN = [300, 120, 300, 120, 600];

// ব্রাউজার কেবল তখনই কাঁপায় যখন পাতায় আগে অন্তত একবার চাপ পড়েছে, আর
// ফোন পুরো silent থাকলে কাঁপায় না — তাই কাঁপা না হলেও চোখে দেখার ব্যবস্থা থাকে
function vibrate(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (err) {
    // কাঁপানো না গেলেও ছবিটা তো দেখাচ্ছে
  }
}

/* ---------- সঙ্গীর আঁকা ---------- */

function DrawOverlay({ id, from, onDone }) {
  const canvasRef = useRef(null);
  const doneRef = useRef(onDone);
  const [name, setName] = useState(from);
  const [phase, setPhase] = useState('live'); // live → done → out
  doneRef.current = onDone;

  useEffect(() => {
    const lite = document.documentElement.classList.contains('lite');
    const painter = createPainter(canvasRef.current, { glow: !lite });
    let alive = true;
    let after = 0;
    let queue = [];
    let finished = false;
    let lastNew = Date.now();
    let fails = 0;
    let aspectSet = false;
    let pollTimer = null;
    let holdTimer = null;
    let raf = 0;

    const onResize = () => painter.resize();
    window.addEventListener('resize', onResize);

    // বিন্দুগুলো এক ঝটকায় না বসিয়ে প্রতি ফ্রেমে কয়েকটা করে — তাই আঁকাটা
    // আঙুল চলার মতো করেই ফুটে ওঠে। অনেক জমে থাকলে (নোটিফিকেশন থেকে এসে
    // পুরোটা আবার দেখানো) সমান গতিতে, নইলে পরের টুকরো আসার আগেই শেষ করি।
    function frame() {
      if (!alive) return;
      if (queue.length) {
        const n = queue.length > 400 ? 8 : Math.max(2, Math.ceil(queue.length / 12));
        queue.splice(0, n).forEach((op) => painter.apply(op));
      } else if (finished && !holdTimer) {
        setPhase('done');
        holdTimer = setTimeout(() => {
          if (!alive) return;
          setPhase('out');
          holdTimer = setTimeout(() => alive && doneRef.current(), 1200);
        }, HOLD);
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    async function poll() {
      if (!alive) return;
      let wait = POLL;
      try {
        const d = await getTouch(id, after);
        if (!alive) return;
        fails = 0;
        if (d.from) setName(d.from);
        if (!aspectSet) {
          painter.setAspect(d.aspect || 2);
          aspectSet = true;
        }
        if (d.parts.length) {
          lastNew = Date.now();
          d.parts.forEach((p) => {
            queue = queue.concat(partOps(p.data));
            after = p.seq;
          });
        }
        // একবারে ৪০০ টুকরো পর্যন্ত আসে — বাকি থাকলে সাথে সাথে আবার চাই
        if (d.parts.length >= 400) wait = 0;
        else if (d.done || Date.now() - lastNew > QUIET) finished = true;
      } catch (err) {
        fails += 1;
        if (err.status === 404 || fails > 6) finished = true;
        wait = POLL * 3;
      }
      if (!finished && alive) pollTimer = setTimeout(poll, wait);
    }
    poll();

    return () => {
      alive = false;
      clearTimeout(pollTimer);
      clearTimeout(holdTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [id]);

  return (
    <div className={'touch-layer' + (phase === 'out' ? ' out' : '')}>
      <canvas ref={canvasRef} className="touch-canvas" />
      <div className="touch-chip" role="status">
        <HeartIcon size={15} filled />
        <span>
          {name || 'সঙ্গী'} {phase === 'live' ? 'আঁকছেন…' : 'এঁকেছেন'}
        </span>
        <button type="button" aria-label="বন্ধ করুন" onClick={() => doneRef.current()}>
          <CrossIcon size={14} />
        </button>
      </div>
    </div>
  );
}

/* ---------- ফোন কাঁপানোর ডাক ---------- */

function BuzzPop({ from, late, onDone }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => doneRef.current(), BUZZ_SHOW);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="buzz-pop" role="status">
      <div className="buzz-heart">
        <HeartIcon size={46} filled />
      </div>
      <b>
        {from || 'সঙ্গী'} {late ? 'আপনাকে ডেকেছিলেন' : 'আপনাকে ডাকছেন'}
      </b>
    </div>
  );
}

/* ---------- পুরোটা ---------- */

export default function TouchLayer() {
  const [mounted, setMounted] = useState(false);
  const [draw, setDraw] = useState(null);
  const [buzz, setBuzz] = useState(null);
  const shown = useRef(new Set());

  // একই আঁকা বা ডাক দুই পথে এলে (পুশ আর পরের খোঁজ) একবারই দেখাই
  const openDraw = useCallback((id, from) => {
    if (!id || shown.current.has('d' + id)) return;
    shown.current.add('d' + id);
    vibrate(80);
    setDraw({ id, from: from || '' });
  }, []);

  const showBuzz = useCallback((id, from, { shake = true, late = false, mark = false } = {}) => {
    if (id && shown.current.has('b' + id)) return;
    if (id) shown.current.add('b' + id);
    if (shake) vibrate(BUZZ_PATTERN);
    setBuzz({ key: Date.now(), from: from || '', late });
    // পুশে সরাসরি এলে সার্ভারকে জানিয়ে দিই যে দেখা হয়েছে — নইলে পরে অ্যাপ
    // খুললে "ডেকেছিলেন" বলে আবার দেখাত (আঁকার বেলায় প্রথম টানেই এটা হয়ে যায়)
    if (mark && id) getTouch(id, 0).catch(() => {});
  }, []);

  const closeDraw = useCallback(() => setDraw(null), []);
  const closeBuzz = useCallback(() => setBuzz(null), []);

  useEffect(() => {
    setMounted(true);

    // ১. পাতা খোলা অবস্থায় সার্ভিস ওয়ার্কারের খবর
    const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
    const onMessage = (e) => {
      const d = e.data;
      if (!d || d.source !== 'deen-touch') return;
      if (d.type === 'touch') openDraw(Number(d.id), d.from);
      else if (d.type === 'buzz') showBuzz(Number(d.id), d.from, { mark: true });
    };
    if (sw) {
      sw.addEventListener('message', onMessage);
      if (typeof sw.startMessages === 'function') sw.startMessages();
    }

    // ২. নোটিফিকেশন থেকে এলে — ঠিকানা থেকে চিহ্নটা মুছে দিই, যাতে রিফ্রেশে আবার না খোলে
    const q = new URLSearchParams(window.location.search);
    const touchId = Number(q.get('touch')) || 0;
    const buzzId = Number(q.get('buzz')) || 0;
    if (touchId || buzzId) {
      q.delete('touch');
      q.delete('buzz');
      const rest = q.toString();
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + (rest ? '?' + rest : '') + window.location.hash
      );
    }
    if (touchId) openDraw(touchId, '');
    if (buzzId) {
      // নোটিফিকেশনেই একবার কেঁপেছে, এখানে শুধু দেখাই
      getTouch(buzzId, 0)
        .then((d) => showBuzz(buzzId, d.from, { shake: false, late: true }))
        .catch(() => {});
    }

    // ৩. পুশ না পৌঁছালেও — অ্যাপ সামনে এলেই একবার খোঁজ
    let lastCheck = 0;
    const check = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck < CHECK_GAP) return;
      lastCheck = Date.now();
      getPendingTouch()
        .then((d) => {
          const t = d && d.touch;
          if (!t) return;
          if (t.kind === 'draw') openDraw(t.id, t.from);
          else showBuzz(t.id, t.from, { late: true });
        })
        .catch(() => {});
    };
    const first = setTimeout(check, 1500);
    document.addEventListener('visibilitychange', check);

    return () => {
      clearTimeout(first);
      document.removeEventListener('visibilitychange', check);
      if (sw) sw.removeEventListener('message', onMessage);
    };
  }, [openDraw, showBuzz]);

  if (!mounted) return null;

  return createPortal(
    <>
      {draw ? <DrawOverlay key={draw.id} id={draw.id} from={draw.from} onDone={closeDraw} /> : null}
      {buzz ? <BuzzPop key={buzz.key} from={buzz.from} late={buzz.late} onDone={closeBuzz} /> : null}
    </>,
    document.body
  );
}
