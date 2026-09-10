'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHead from './PageHead';
import JuzReader from './JuzReader';
import { BookIcon, ChevronIcon, CheckIcon, LayersIcon, ListIcon, PlayIcon, PauseIcon, SpinIcon } from './Icons';
import { JUZ_NAMES, JUZ_RANGE, SURAHS, juzBreaksIn, juzParts, juzSpanOf } from '../lib/quranMeta';
import { surahBn } from '../lib/content/surahNames';
import { toBanglaUccharon } from '../lib/uccharon';
import { QARIS, ayahAudioUrl, loadQari, saveQari } from '../lib/recite';
import { bnNum } from '../lib/store';
import { getQuran, getQuranJuz, markQuran } from '../lib/cloud';

const EMPTY_SUMMARY = { ayahs: 0, juzDone: 0, juzTotal: 30, juz: [], bySurah: {} };

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
        s.ar.includes(q.trim()) ||
        JUZ_NAMES[juzSpanOf(s.id).from - 1][0].includes(q.trim())
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
          const sp = juzSpanOf(s.id);
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
                <small className="surah-juz">
                  পারা {sp.from === sp.to ? bnNum(sp.from) : `${bnNum(sp.from)}–${bnNum(sp.to)}`}
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

/* ---------- পারার তালিকা ---------- */
//
// সুরা ধরে খোঁজা আর পারা ধরে খোঁজা — দুটো আলাদা অভ্যাস। যিনি রোজ এক পারা
// পড়েন তিনি "৫ নম্বর পারা" খোঁজেন, সুরার নাম নয়। পারা সুরার মাঝখানে শুরু
// বা শেষ হতে পারে, তাই কোন আয়াত থেকে কোন আয়াত সেটাও লিখে দিই।

function JuzList({ onOpen, onRead, summary }) {
  const [open, setOpen] = useState(null);

  return (
    <div className="juz-list">
      {JUZ_RANGE.map((r, i) => {
        const n = i + 1;
        const [bn, ar] = JUZ_NAMES[i];
        const read = Math.min(summary.juz?.[i] || 0, r.count);
        const done = read >= r.count;
        const parts = juzParts(n);
        const isOpen = open === n;

        return (
          <section key={n} className={'juz' + (isOpen ? ' open' : '') + (done ? ' done' : '')}>
            <button type="button" className="juz-head" onClick={() => onRead(n)}
                    aria-label={'পারা ' + bnNum(n) + ' পড়ুন'}>
              <span className={'juz-num' + (done ? ' done' : '')}>
                {done ? <CheckIcon size={13} /> : bnNum(n)}
              </span>
              <span className="juz-mid">
                <b>{bn}</b>
                <small>
                  পারা {bnNum(n)} · {bnNum(r.count)} আয়াত · {bnNum(read)} পড়া
                </small>
                <i className="juz-bar">
                  <i style={{ width: Math.round((read / r.count) * 100) + '%' }} />
                </i>
              </span>
              <span className="juz-ar">{ar}</span>
            </button>

            <button type="button" className="juz-peek" onClick={() => setOpen(isOpen ? null : n)}
                    aria-expanded={isOpen}>
              {isOpen ? 'সুরার তালিকা লুকান' : 'কোন কোন সুরা আছে'}
              <ChevronIcon dir={isOpen ? 'left' : 'right'} size={14} />
            </button>

            {isOpen ? (
              <div className="juz-body">
                {parts.map((x) => (
                  <button key={x.id} type="button" className="juz-part" onClick={() => onOpen(x.id)}>
                    <b>{surahBn(x.id)}</b>
                    <small>
                      {x.whole
                        ? `পুরো সুরা · ${bnNum(SURAHS[x.id - 1].ayahs)} আয়াত`
                        : `আয়াত ${bnNum(x.from)}–${bnNum(x.to)}`}
                    </small>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

/* ---------- এক সুরা পড়া ---------- */

function SurahView({ id, qari, onBack, onGo, readAyahs, onToggle, onWholeSurah, busy }) {
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

  // আগের-পরের সুরা। ১ এর আগে কিছু নেই, ১১৪ এর পরেও নেই।
  const prev = id > 1 ? SURAHS[id - 2] : null;
  const next = id < 114 ? SURAHS[id] : null;

  // এই সুরাটা কোন পারায়, আর ভেতরে কোথায় নতুন পারা শুরু হয়
  const span = juzSpanOf(id);
  const breaks = juzBreaksIn(id);
  const breakAt = new Map(breaks.map((b) => [b.ayah, b.juz]));

  return (
    <>
      <div className="surah-head">
        <button type="button" className="nav" onClick={onBack} aria-label="তালিকায় ফিরুন">
          <ListIcon size={17} />
        </button>
        <button
          type="button"
          className="nav"
          disabled={!prev}
          onClick={() => prev && onGo(prev.id)}
          aria-label={prev ? 'আগের সুরা — ' + surahBn(prev.id) : 'এটাই প্রথম সুরা'}
        >
          <ChevronIcon dir="left" />
        </button>
        <div className="month-title">
          <strong>{surahBn(id)}</strong>
          <span>
            {meta.bn} · {bnNum(meta.ayahs)} আয়াত · {meta.type === 'meccan' ? 'মাক্কি' : 'মাদানি'}
          </span>
        </div>
        <button
          type="button"
          className="nav"
          disabled={!next}
          onClick={() => next && onGo(next.id)}
          aria-label={next ? 'পরের সুরা — ' + surahBn(next.id) : 'এটাই শেষ সুরা'}
        >
          <ChevronIcon dir="right" />
        </button>
      </div>

      <div className="juz-strip">
        <span className="juz-chip">
          {span.from === span.to
            ? `পারা ${bnNum(span.from)}`
            : `পারা ${bnNum(span.from)}–${bnNum(span.to)}`}
          <small>{JUZ_NAMES[span.from - 1][0]}</small>
        </span>
        {breaks.map((b) => (
          <span key={b.juz} className="juz-chip soft">
            পারা {bnNum(b.juz)}
            <small>আয়াত {bnNum(b.ayah)} থেকে</small>
          </span>
        ))}
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
            const starts = breakAt.get(v.id);
            return (
              <div key={v.id} className={'ayah' + (on ? ' read' : '')}>
                {starts ? (
                  <div className="juz-mark">
                    <span>۞</span>
                    পারা {bnNum(starts)} — {JUZ_NAMES[starts - 1][0]} শুরু
                  </div>
                ) : null}
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

      {/* সুরা শেষ। তালিকায় ফিরে গিয়ে আবার খোঁজার দরকার নেই — পরেরটা এখানেই। */}
      {data && shown >= data.verses.length ? (
        <>
          <div className="surah-end" aria-hidden="true">
            <i />
            <span>۞</span>
            <i />
          </div>

          <div className="surah-pager">
            {prev ? (
              <button type="button" className="pager" onClick={() => onGo(prev.id)}>
                <ChevronIcon dir="left" size={16} />
                <span>
                  <small>আগের সুরা</small>
                  <b>{surahBn(prev.id)}</b>
                </span>
              </button>
            ) : (
              <span className="pager empty">এটাই প্রথম সুরা</span>
            )}

            {next ? (
              <button type="button" className="pager next" onClick={() => onGo(next.id)}>
                <span>
                  <small>পরের সুরা</small>
                  <b>{surahBn(next.id)}</b>
                </span>
                <ChevronIcon dir="right" size={16} />
              </button>
            ) : (
              <span className="pager empty">কুরআন এখানেই শেষ</span>
            )}
          </div>

          <button type="button" className="btn wide" onClick={onBack}>
            সুরার তালিকায় ফিরুন
          </button>
        </>
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
  const [openJuz, setOpenJuz] = useState(null);
  const [juzMarks, setJuzMarks] = useState({});
  const [view, setView] = useState('surah');
  const [readAyahs, setReadAyahs] = useState([]);
  const [readBySurah, setReadBySurah] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const openRef = useRef(null);

  // সারাংশে সুরাভিত্তিক গোনাও থাকে, তাই তালিকায় সাথে সাথেই বোঝা যায়
  // কোনটা শেষ — সুরাটা একবার না খুললেও।
  const take = useCallback((res) => {
    const sum = res && res.summary ? res.summary : EMPTY_SUMMARY;
    setSummary(sum);
    if (sum.bySurah) setReadBySurah(sum.bySurah);
  }, []);

  const loadTop = useCallback(async () => {
    try {
      take(await getQuran());
    } catch (err) {
      setMsg('পড়ার হিসাব আনা গেল না');
    }
  }, [take]);

  useEffect(() => {
    loadTop();
    setQari(loadQari());
  }, [loadTop]);

  function changeQari(id) {
    setQari(id);
    saveQari(id);
  }

  // পরের সুরায় গেলে পাতার শেষ থেকে যাচ্ছি — উপরে না ফিরলে নতুন সুরাটা
  // মাঝখান থেকে শুরু হয়েছে মনে হবে
  function goSurah(next) {
    setOpenJuz(null);
    setOpen(next);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function goJuz(next) {
    setOpen(null);
    setOpenJuz(next);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  }

  // সুরা খুললে ওই সুরার টিকগুলো আনি
  useEffect(() => {
    if (!open) return;
    openRef.current = open;
    // আগের সুরার টিকগুলো সাথে সাথেই ফেলে দিই। নইলে পরের সুরায় গেলে সার্ভারের
    // উত্তর আসার আগ পর্যন্ত ওখানকার ১-২-৩ নম্বর আয়াত পড়া দেখাবে — আগে
    // তালিকা হয়ে যেতে হতো বলে চোখে পড়ত না, এখন প্রতিবারই পড়বে।
    setReadAyahs([]);
    let alive = true;
    getQuran(open)
      .then((res) => {
        if (!alive || openRef.current !== open) return;
        setReadAyahs(res.ayahs || []);
        take(res);
      })
      .catch(() => setMsg('টিকগুলো আনা গেল না'));
    return () => {
      alive = false;
    };
  }, [open]);

  // পারা খুললে ওই পারার সব টিক একসাথে — সুরা ধরে ৩৭ বার নয়
  useEffect(() => {
    if (!openJuz) return undefined;
    let alive = true;
    setJuzMarks({});
    getQuranJuz(openJuz)
      .then((res) => {
        if (!alive) return;
        setJuzMarks(res.marks || {});
        take(res);
      })
      .catch(() => setMsg('টিকগুলো আনা গেল না'));
    return () => {
      alive = false;
    };
  }, [openJuz]);

  // পারার পাতা থেকে টিক — সুরাটাও বলে দিতে হয়, কারণ একই পাতায় অনেক সুরা
  const applyJuz = useCallback(
    async (surah, ayahs, read) => {
      if (!ayahs.length) return;
      setBusy(true);
      setMsg('');
      const before = juzMarks;
      const set = new Set(before[surah] || []);
      ayahs.forEach((a) => (read ? set.add(a) : set.delete(a)));
      setJuzMarks({ ...before, [surah]: Array.from(set) });
      try {
        take(await markQuran(surah, ayahs, read));
      } catch (err) {
        setJuzMarks(before);
        setMsg('হিসাবটা সার্ভারে রাখা গেল না — টিকটা ফিরিয়ে নেওয়া হলো, আবার চেষ্টা করুন');
      }
      setBusy(false);
    },
    [juzMarks, take]
  );

  // পুরো পারা এক চাপে। একেকটা সুরার জন্য একেকটা অনুরোধ, একটাও যেন বাদ না যায়।
  const applyWholeJuz = useCallback(
    async (parts, read) => {
      setBusy(true);
      setMsg('');
      const before = juzMarks;
      const next = { ...before };
      parts.forEach((x) => {
        const set = new Set(read ? [] : next[x.id] || []);
        if (read) {
          (next[x.id] || []).forEach((a) => set.add(a));
          for (let a = x.from; a <= x.to; a += 1) set.add(a);
        } else {
          for (let a = x.from; a <= x.to; a += 1) set.delete(a);
        }
        next[x.id] = Array.from(set);
      });
      setJuzMarks(next);
      try {
        for (const x of parts) {
          const list = [];
          for (let a = x.from; a <= x.to; a += 1) list.push(a);
          // eslint-disable-next-line no-await-in-loop
          take(await markQuran(x.id, list, read));
        }
      } catch (err) {
        setJuzMarks(before);
        setMsg('হিসাবটা সার্ভারে রাখা গেল না — টিকটা ফিরিয়ে নেওয়া হলো, আবার চেষ্টা করুন');
      }
      setBusy(false);
    },
    [juzMarks, take]
  );

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
        take(await markQuran(open, ayahs, read));
      } catch (err) {
        setReadAyahs(before);
        setMsg('হিসাবটা সার্ভারে রাখা গেল না — টিকটা ফিরিয়ে নেওয়া হলো, আবার চেষ্টা করুন');
      }
      setBusy(false);
    },
    [open, readAyahs, take]
  );

  return (
    <main className="shell">
      <PageHead title="কুরআন" sub="পড়ুন আর কতটুকু হলো দেখুন" />
      <Progress summary={summary} />
      <QariPicker qari={qari} onChange={changeQari} />
      {msg ? <div className="auth-error">{msg}</div> : null}

      {!open && !openJuz ? (
        <div className="pickbar" role="tablist" aria-label="কীভাবে দেখবেন">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'surah'}
            className={'pickbar-btn' + (view === 'surah' ? ' on' : '')}
            onClick={() => setView('surah')}
          >
            <BookIcon size={16} />
            সুরা
            <em>{bnNum(114)}</em>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'juz'}
            className={'pickbar-btn' + (view === 'juz' ? ' on' : '')}
            onClick={() => setView('juz')}
          >
            <LayersIcon size={16} />
            পারা
            <em>{bnNum(30)}</em>
          </button>
        </div>
      ) : null}

      {openJuz ? (
        <JuzReader
          juz={openJuz}
          qari={qari}
          marks={juzMarks}
          busy={busy}
          onBack={() => setOpenJuz(null)}
          onGo={goJuz}
          onToggle={(surah, ayah, read) => applyJuz(surah, [ayah], read)}
          onWholeJuz={applyWholeJuz}
        />
      ) : open ? (
        <SurahView
          id={open}
          qari={qari}
          onBack={() => setOpen(null)}
          onGo={goSurah}
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
      ) : view === 'juz' ? (
        <JuzList onOpen={goSurah} onRead={goJuz} summary={summary} />
      ) : (
        <SurahList onOpen={goSurah} readBySurah={readBySurah} />
      )}
    </main>
  );
}
