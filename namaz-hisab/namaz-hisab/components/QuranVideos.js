'use client';

import { useEffect, useRef, useState } from 'react';
import { videoSource } from '../lib/content/quranVideos';
import { bnNum } from '../lib/store';

// কুরআন শেখার ভিডিও — কুরআনের পাতার "ভিডিও" ট্যাব।
//
// ইউটিউবের প্লেলিস্ট আমাদের পাতার ভেতরেই চলে, ইউটিউবে পাঠিয়ে দিই না। উপরে
// প্লেয়ার, নিচে প্লেলিস্টের সব ভিডিওর তালিকা — চাপ দিলে ওই প্লেয়ারেই চলে।
// প্লেলিস্টের বদলে একটা ভিডিওর লিংক দেওয়া থাকলে শুধু ওটাই চলে, তালিকা থাকে না।
//
// ভিডিওর তালিকা নিতে ইউটিউবের কোনো চাবি (API key) লাগে না: প্লেয়ার নিজেই
// প্লেলিস্টের ভিডিওগুলোর আইডি জানায়, আর নামগুলো আসে ইউটিউবের খোলা oEmbed
// ঠিকানা থেকে (ব্রাউজার থেকে সরাসরি ডাকা যায়)। নামগুলো ফোনে জমা রাখি, তাই
// পরের বার আর আনতে হয় না।

const KEY_AT = 'namaz-hisab:video-at:v1';        // কোন প্লেলিস্টের কোন ভিডিওতে ছিলেন
const KEY_TITLES = 'namaz-hisab:video-titles:v1';

function readJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v && typeof v === 'object' ? v : fallback;
  } catch (err) {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // জমা না থাকলেও এই বারের দেখা চলবে
  }
}

// ইউটিউবের প্লেয়ার-স্ক্রিপ্ট একবারই নামাই, পাতায় যতবারই আসা-যাওয়া হোক
let apiPromise = null;
function loadYouTube() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const before = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof before === 'function') before();
      resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      apiPromise = null;
      s.remove();
      reject(new Error('load'));
    };
    document.head.appendChild(s);
  });
  return apiPromise;
}

function oembed(url) {
  return fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url)).then((r) => {
    if (!r.ok) throw new Error('oembed');
    return r.json();
  });
}

const ERRORS = {
  2: 'ভিডিওর ঠিকানায় গোলমাল আছে।',
  5: 'এই ভিডিওটা এই ব্রাউজারে চালানো যাচ্ছে না।',
  100: 'ভিডিওটা আর নেই, বা লুকিয়ে রাখা হয়েছে।',
  101: 'এই ভিডিওর মালিক অন্য সাইটে চালানো বন্ধ রেখেছেন — তালিকা থেকে অন্যটা বেছে নিন।',
  150: 'এই ভিডিওর মালিক অন্য সাইটে চালানো বন্ধ রেখেছেন — তালিকা থেকে অন্যটা বেছে নিন।',
};

export default function QuranVideos() {
  const src = videoSource();
  const list = src && src.list ? src.list : '';
  const single = src && src.video ? src.video : '';
  const boxRef = useRef(null);
  const playerRef = useRef(null);
  const [ids, setIds] = useState(single ? [single] : []);
  const [titles, setTitles] = useState({});
  const [current, setCurrent] = useState(-1);
  const [about, setAbout] = useState(null);
  const [err, setErr] = useState('');

  // প্লেয়ার বসানো
  useEffect(() => {
    if ((!list && !single) || !boxRef.current) return undefined;
    let alive = true;
    let tries = 0;
    let timer = null;
    const box = boxRef.current;

    const at = list ? readJson(KEY_AT, {})[list] : 0;
    const start = Number.isInteger(at) && at > 0 ? at : 0;

    // প্লেয়ারের জন্য আলাদা একটা ঘর বানাই — ইউটিউব ওটাকে iframe দিয়ে বদলে
    // দেয়, React-এর নিজের বানানো কিছুতে যেন হাত না পড়ে
    const slot = document.createElement('div');
    box.appendChild(slot);

    // প্লেলিস্টের আইডিগুলো প্লেয়ার তৈরি হওয়ার সাথে সাথে সবসময় পাওয়া যায়
    // না, তাই না পাওয়া পর্যন্ত কয়েকবার দেখি
    function readList() {
      const p = playerRef.current;
      if (!alive || !p || typeof p.getPlaylist !== 'function') return false;
      const got = p.getPlaylist();
      if (Array.isArray(got) && got.length) {
        setIds((old) => (old.length === got.length && old[0] === got[0] ? old : got));
        return true;
      }
      return false;
    }

    function watchList() {
      if (readList() || tries > 120) return;   // ধীর নেটে এক মিনিট পর্যন্ত
      tries += 1;
      timer = setTimeout(watchList, 500);
    }

    loadYouTube()
      .then((YT) => {
        if (!alive) return;
        playerRef.current = new YT.Player(slot, {
          host: 'https://www.youtube-nocookie.com',
          width: '100%',
          height: '100%',
          ...(list ? {} : { videoId: single }),
          playerVars: {
            ...(list ? { listType: 'playlist', list, index: start } : {}),
            playsinline: 1,   // আইফোনে নিজে থেকে পুরো পর্দায় চলে না গিয়ে পাতাতেই চলে
            rel: 0,           // শেষে অন্য চ্যানেলের ভিডিও দেখায় না
            iv_load_policy: 3,
            hl: 'bn',
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              setCurrent(start);
              if (list) watchList();
            },
            onStateChange: () => {
              const p = playerRef.current;
              if (!p || !list) return;
              readList();
              const i = p.getPlaylistIndex();
              if (i >= 0) {
                setCurrent(i);
                setErr('');
                const all = readJson(KEY_AT, {});
                all[list] = i;
                writeJson(KEY_AT, all);
              }
            },
            onError: (e) => {
              if (alive) setErr(ERRORS[e.data] || 'ভিডিওটা চালানো গেল না।');
            },
          },
        });
      })
      .catch(() => {
        if (alive) setErr('ভিডিও দেখতে ইন্টারনেট লাগবে — নেট দেখে পাতাটা আবার খুলুন।');
      });

    return () => {
      alive = false;
      clearTimeout(timer);
      try {
        if (playerRef.current) playerRef.current.destroy();
      } catch (e) {
        // প্লেয়ার পুরো তৈরি হওয়ার আগেই পাতা ছাড়লে এমন হয়
      }
      playerRef.current = null;
      box.innerHTML = '';
    };
  }, [list, single]);

  // প্লেলিস্টের (বা একা ভিডিওর) নাম আর কার বানানো
  useEffect(() => {
    if (!list && !single) return undefined;
    let alive = true;
    oembed(list ? 'https://www.youtube.com/playlist?list=' + list : 'https://www.youtube.com/watch?v=' + single)
      .then((d) => alive && setAbout({ title: d.title, by: d.author_name }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [list, single]);

  // ভিডিওর নাম — জমানোগুলো সাথে সাথে, বাকিগুলো একসাথে চারটা করে আনি
  useEffect(() => {
    if (!list || !ids.length) return undefined;
    let alive = true;
    const saved = readJson(KEY_TITLES, {});
    const known = {};
    ids.forEach((id) => {
      if (saved[id]) known[id] = saved[id];
    });
    setTitles(known);

    const need = ids.filter((id) => !known[id]);
    let at = 0;
    async function worker() {
      while (alive && at < need.length) {
        const id = need[at];
        at += 1;
        try {
          // eslint-disable-next-line no-await-in-loop
          const d = await oembed('https://www.youtube.com/watch?v=' + id);
          known[id] = d.title;
          if (alive) setTitles((t) => ({ ...t, [id]: d.title }));
        } catch (e) {
          // নাম না পেলে নম্বর দিয়েই দেখাই
        }
      }
    }
    Promise.all([worker(), worker(), worker(), worker()]).then(() => {
      // শুধু এই প্লেলিস্টের নামগুলোই রাখি, পুরনো জঞ্জাল নয়
      if (Object.keys(known).length) writeJson(KEY_TITLES, known);
    });
    return () => {
      alive = false;
    };
  }, [list, ids]);

  function playAt(i) {
    const p = playerRef.current;
    if (!p || typeof p.playVideoAt !== 'function') return;
    setErr('');
    setCurrent(i);
    p.playVideoAt(i);
    if (boxRef.current) boxRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (!src) {
    return <div className="empty-note">ভিডিও শিগগিরই আসছে, ইনশাআল্লাহ।</div>;
  }

  return (
    <>
      <div className="yt-box" ref={boxRef} />

      {err ? <div className="auth-error" style={{ marginTop: 10 }}>{err}</div> : null}

      <div className="yt-about">
        <b>{about ? about.title : 'কুরআন শেখার ভিডিও'}</b>
        <small>
          {single ? (about && about.by) || '' : null}
          {list && about && about.by ? about.by + ' · ' : ''}
          {list ? (ids.length ? `${bnNum(ids.length)}টি ভিডিও` : 'তালিকা আনা হচ্ছে…') : ''}
          {list && current >= 0 && ids.length ? ` · এখন ${bnNum(current + 1)} নম্বর` : ''}
        </small>
      </div>

      {list && ids.length ? (
        <div className="yt-list">
          {ids.map((id, i) => (
            <button
              key={id + ':' + i}
              type="button"
              className={'yt-row' + (i === current ? ' on' : '')}
              aria-current={i === current ? 'true' : undefined}
              onClick={() => playAt(i)}
            >
              {/* নম্বরটা ছবির বাইরে — অনেক চ্যানেল ছবির কোণেই "পর্ব ১" লিখে দেয় */}
              <span className="yt-thumb">
                <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" loading="lazy" width="112" height="63" />
              </span>
              <span className="yt-text">
                <small>
                  {bnNum(i + 1)} নম্বর{i === current ? ' · এখন চলছে' : ''}
                </small>
                <span className="yt-title">{titles[id] || `ভিডিও ${bnNum(i + 1)}`}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
