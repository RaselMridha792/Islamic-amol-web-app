'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHead from './PageHead';
import { ChevronIcon, CheckIcon, PlayIcon, PauseIcon, SpinIcon } from './Icons';
import { SURAHS } from '../lib/quranMeta';
import { surahBn } from '../lib/content/surahNames';
import { toBanglaUccharon } from '../lib/uccharon';
import { QARIS, ayahAudioUrl, loadQari, saveQari } from '../lib/recite';
import { bnNum } from '../lib/store';
import { getQuran, markQuran } from '../lib/cloud';

const EMPTY_SUMMARY = { ayahs: 0, juzDone: 0, juzTotal: 30 };

// একবারে কয়টা আয়াত পাতায় বসবে। বাকারায় ২৮৬টা — সব একসাথে বসালে কম শক্তির
// ফোনে পাতাটা খুলতেই দেরি হয়ে যায়।
const CHUNK = 30;

/* ---------- উপরে কতটুকু পড়া হলো ---------- */

function Progress({ summary }) {
  const pct = Math.round((summary.ayahs / 6236) * 100);
  return (
    <div className="quran-progress">
      <div className="qp-row">
        <div>
          <b>{bnNum(summary.juzDone)}</b>
          <small>পারা শেষ</small>
        </div>
        <div>
          <b>{bnNum(summary.ayahs)}</b>
          <small>আয়াত পড়া</small>
        </div>
        <div>
          <b>{bnNum(pct)}%</b>
          <small>পুরো কুরআনের</small>
        </div>
      </div>
      <div className="qp-bar">
        <i style={{ width: Math.max(pct, 1) + '%' }} />
      </div>
    </div>
  );
}

/* ---------- সুরার তালিকা ---------- */

function SurahList({ onOpen, readBySurah }) {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();

  const list = useMemo(() => {
    if (!term) return SURAHS;
    return SURAHS.filter(
      (s) =>
        surahBn(s.id).includes(q.trim()) ||
        s.tr.toLowerCase().includes(term) ||
        s.bn.toLowerCase().includes(term) ||
        String(s.id) === term ||
        s.ar.includes(q.trim())
    );
  }, [term, q]);

  return (
    <>
      <div className="field" style={{ marginTop: 4 }}>
        <input
          type="text"
          value={q}
          placeholder="সুরা খুঁজুন — নাম বা নম্বর"
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="surah-list">
        {list.map((s) => {
          const read = readBySurah[s.id] || 0;
          const done = read >= s.ayahs;
          return (
            <button key={s.id} type="button" className="surah-row" onClick={() => onOpen(s.id)}>
              <span className={'surah-num' + (done ? ' done' : '')}>
                {done ? <CheckIcon size={13} /> : bnNum(s.id)}
              </span>
              <span className="surah-mid">
                <b>{surahBn(s.id)}</b>
                <small>
                  {s.bn} · {bnNum(s.ayahs)} আয়াত · {s.type === 'meccan' ? 'মাক্কি' : 'মাদানি'}
                </small>
              </span>
              <span className="surah-ar">{s.ar}</span>
            </button>
          );
        })}
        {list.length === 0 ? <div className="empty-note">এই নামে কোনো সুরা পাওয়া গেল না।</div> : null}
      </div>
    </>
  );
}

/* ---------- এক সুরা পড়া ---------- */

function SurahView({ id, qari, onBack, readAyahs, onToggle, onWholeSurah, busy }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(null);   // কোন আয়াত বাজছে
  const [loading, setLoading] = useState(null);
  const [audioMsg, setAudioMsg] = useState('');
  const audioRef = useRef(null);
  const meta = SURAHS[id - 1];

  // সুরা বা কারী বদলালে যা বাজছিল তা থামিয়ে দিই
  useEffect(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute('src');
    }
    setPlaying(null);
    setLoading(null);
    return () => {
      if (a) {
        a.pause();
        a.removeAttribute('src');
      }
    };
  }, [id, qari]);

  function playAyah(ayahId) {
    const a = audioRef.current;
    if (!a) return;
    if (playing === ayahId) {
      a.pause();
      setPlaying(null);
      return;
    }
    setLoading(ayahId);
    setAudioMsg('');
    a.src = ayahAudioUrl(id, ayahId, qari);
    a.play()
      .then(() => {
        setPlaying(ayahId);
        setLoading(null);
      })
      .catch(() => {
        setLoading(null);
        setPlaying(null);
        setAudioMsg('তিলাওয়াতটা চালানো গেল না — নেট দেখে আবার চেষ্টা করুন।');
      });
  }

  // আয়াত শেষ হলে ওখানেই থামে — নিজে থেকে পরেরটা বাজে না
  function handleEnded() {
    setPlaying(null);
  }

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    fetch('/quran/' + id + '.json')
      .then((r) => {
        if (!r.ok) throw new Error('load');
        return r.json();
      })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setError('সুরাটা আনা গেল না। নেট দেখে আবার চেষ্টা করুন।');
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const readSet = useMemo(() => new Set(readAyahs), [readAyahs]);
  const allRead = data ? data.verses.every((v) => readSet.has(v.id)) : false;

  // উচ্চারণটা আগে প্রতিবার পাতা আঁকার সময় নতুন করে বানানো হতো — একটা টিক
  // দিলেই গোটা সুরার আয়াতগুলো আবার হিসাব হতো। এখন যেটা পর্দায় এসেছে কেবল
  // তারটাই বানাই, আর বানানোটা জমা রাখি, তাই দ্বিতীয়বার আর খাটতে হয় না।
  //
  // সুরা বদলালে জমানোটা ফেলে দিতে হয় — নইলে সুরা ৩-এর ১ নম্বর আয়াতে সুরা
  // ২-এর ১ নম্বরটা দেখাবে। তাই আঁকার সময়েই মিলিয়ে নিই, effect-এর অপেক্ষায় নয়।
  const cacheRef = useRef({ id: null, map: null });
  if (cacheRef.current.id !== id) cacheRef.current = { id, map: new Map() };

  const uccharonOf = (v) => {
    const box = cacheRef.current.map;
    const hit = box.get(v.id);
    if (hit !== undefined) return hit;
    const made = toBanglaUccharon(v.text, id, v.id);
    box.set(v.id, made);
    return made;
  };

  // পাতায় একসাথে সব আয়াত না বসিয়ে ধাপে ধাপে — নিচে নামলে আরও আসে।
  // বাকারা খুললে শুরুতে ৩০টা, ২৮৬টা নয়।
  const [shown, setShown] = useState(CHUNK);
  const tailRef = useRef(null);

  useEffect(() => {
    setShown(CHUNK);
  }, [id]);

  useEffect(() => {
    const node = tailRef.current;
    if (!node || !data || shown >= data.verses.length) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown((n) => Math.min(n + CHUNK, data.verses.length));
        }
      },
      { rootMargin: '600px' }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [data, shown]);

  const visible = data ? data.verses.slice(0, shown) : [];

  return (
    <>
      <div className="surah-head">
        <button type="button" className="nav" onClick={onBack} aria-label="তালিকায় ফিরুন">
          <ChevronIcon dir="left" />
        </button>
        <div className="month-title">
          <strong>{surahBn(id)}</strong>
          <span>
            {meta.bn} · {bnNum(meta.ayahs)} আয়াত
          </span>
        </div>
        <span className="surah-ar big">{meta.ar}</span>
      </div>

      <button
        type="button"
        className={'btn wide' + (allRead ? '' : ' primary')}
        disabled={busy || !data}
        onClick={() => onWholeSurah(!allRead)}
      >
        {allRead ? 'পুরো সুরার টিক তুলে নিন' : 'পুরো সুরা পড়া হয়েছে'}
      </button>

      {error ? <div className="empty-note" style={{ marginTop: 14 }}>{error}</div> : null}
      {!data && !error ? <div className="empty-note" style={{ marginTop: 14 }}>খোলা হচ্ছে…</div> : null}

      <audio ref={audioRef} preload="none" onEnded={handleEnded} />
      {audioMsg ? <div className="auth-error" style={{ marginTop: 12 }}>{audioMsg}</div> : null}

      {data ? (
        <div className="ayah-list">
          {visible.map((v) => {
            const on = readSet.has(v.id);
            return (
              <div key={v.id} className={'ayah' + (on ? ' read' : '')}>
                <div className="ayah-top">
                  <span className="ayah-no">{bnNum(v.id)}</span>
                  <div className="ayah-acts">
                    <button
                      type="button"
                      className={'ayah-play' + (playing === v.id ? ' on' : '')}
                      aria-label={playing === v.id ? 'থামান' : 'তিলাওয়াত শুনুন'}
                      onClick={() => playAyah(v.id)}
                    >
                      {loading === v.id ? (
                        <SpinIcon />
                      ) : playing === v.id ? (
                        <PauseIcon />
                      ) : (
                        <PlayIcon />
                      )}
                    </button>
                  <button
                    type="button"
                    className={'ayah-tick' + (on ? ' on' : '')}
                    aria-pressed={on}
                    aria-label={on ? 'পড়া হয়েছে, তুলে নিন' : 'পড়া হয়েছে চিহ্ন দিন'}
                    onClick={() => onToggle(v.id, !on)}
                  >
                    <CheckIcon size={14} />
                  </button>
                  </div>
                </div>
                <p className="ayah-ar">{v.text}</p>
                <p className="ayah-tr">{uccharonOf(v)}</p>
                <p className="ayah-bn">{v.translation}</p>
              </div>
            );
          })}

          {shown < data.verses.length ? (
            <div ref={tailRef} className="ayah-more">
              <button type="button" className="btn wide" onClick={() => setShown(data.verses.length)}>
                বাকি {bnNum(data.verses.length - shown)} আয়াত দেখুন
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/* ---------- পুরোটা ---------- */

function QariPicker({ qari, onChange }) {
  return (
    <label className="qari-pick">
      <span>তিলাওয়াত</span>
      <select value={qari} onChange={(e) => onChange(e.target.value)}>
        {QARIS.map((q) => (
          <option key={q.id} value={q.id}>{q.name}</option>
        ))}
      </select>
    </label>
  );
}

export default function QuranReader() {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [qari, setQari] = useState(QARIS[0].id);
  const [open, setOpen] = useState(null);
  const [readAyahs, setReadAyahs] = useState([]);
  const [readBySurah, setReadBySurah] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const openRef = useRef(null);

  const loadTop = useCallback(async () => {
    try {
      const res = await getQuran();
      setSummary(res.summary || EMPTY_SUMMARY);
    } catch (err) {
      setMsg('পড়ার হিসাব আনা গেল না');
    }
  }, []);

  useEffect(() => {
    loadTop();
    setQari(loadQari());
  }, [loadTop]);

  function changeQari(id) {
    setQari(id);
    saveQari(id);
  }

  // সুরা খুললে ওই সুরার টিকগুলো আনি
  useEffect(() => {
    if (!open) return;
    openRef.current = open;
    let alive = true;
    getQuran(open)
      .then((res) => {
        if (!alive || openRef.current !== open) return;
        setReadAyahs(res.ayahs || []);
        setSummary(res.summary || EMPTY_SUMMARY);
      })
      .catch(() => setMsg('টিকগুলো আনা গেল না'));
    return () => {
      alive = false;
    };
  }, [open]);

  const apply = useCallback(
    async (ayahs, read) => {
      if (!open || !ayahs.length) return;
      setBusy(true);
      setMsg('');

      // আগে পর্দায় দেখাই যাতে টিক দিতে অপেক্ষা করতে না হয়, কিন্তু আগের
      // অবস্থাটা ধরে রাখি — সার্ভারে না পৌঁছালে ঠিক ওখানেই ফিরিয়ে দেব,
      // নইলে পর্দায় এক আর সার্ভারে আরেক হয়ে যাবে
      const before = readAyahs;
      const set = new Set(before);
      ayahs.forEach((a) => (read ? set.add(a) : set.delete(a)));
      const after = Array.from(set);
      setReadAyahs(after);

      try {
        const res = await markQuran(open, ayahs, read);
        setSummary(res.summary || EMPTY_SUMMARY);
        setReadBySurah((m) => ({ ...m, [open]: after.length }));
      } catch (err) {
        setReadAyahs(before);
        setMsg('হিসাবটা সার্ভারে রাখা গেল না — টিকটা ফিরিয়ে নেওয়া হলো, আবার চেষ্টা করুন');
      }
      setBusy(false);
    },
    [open, readAyahs]
  );

  return (
    <main className="shell">
      <PageHead title="কুরআন" sub="পড়ুন আর কতটুকু হলো দেখুন" />
      <Progress summary={summary} />
      <QariPicker qari={qari} onChange={changeQari} />
      {msg ? <div className="auth-error">{msg}</div> : null}

      {open ? (
        <SurahView
          id={open}
          qari={qari}
          onBack={() => setOpen(null)}
          readAyahs={readAyahs}
          busy={busy}
          onToggle={(ayah, read) => apply([ayah], read)}
          onWholeSurah={(read) =>
            apply(
              Array.from({ length: SURAHS[open - 1].ayahs }, (_, i) => i + 1),
              read
            )
          }
        />
      ) : (
        <SurahList onOpen={setOpen} readBySurah={readBySurah} />
      )}
    </main>
  );
}
