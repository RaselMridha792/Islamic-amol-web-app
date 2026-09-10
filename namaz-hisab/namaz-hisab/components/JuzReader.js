'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckIcon, ChevronIcon, ListIcon, PauseIcon, PlayIcon, SpinIcon } from './Icons';
import { JUZ_NAMES, SURAHS, globalAyah, juzParts } from '../lib/quranMeta';
import { surahBn } from '../lib/content/surahNames';
import { toBanglaUccharon } from '../lib/uccharon';
import { ayahAudioUrl } from '../lib/recite';
import { bnNum } from '../lib/store';

// একবারে কয়টা আয়াত পাতায় বসবে
const CHUNK = 30;

/* ---------- সুরার নামের ফলক ---------- */
// মুসহাফে প্রতিটা সুরার শুরুতে নকশা করা একটা ফলক থাকে, নামটা তার ভেতরে।
// টানা পড়ার সময় এই ফলকটাই বলে দেয় নতুন সুরা শুরু হলো।

function Orn() {
  return (
    <svg viewBox="0 0 62 30" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
      <path d="M0 15h62" opacity=".5" />
      <path d="M10 15l6-6 6 6-6 6-6-6ZM28 15l6-6 6 6-6 6-6-6Z" />
      <circle cx="52" cy="15" r="3" />
    </svg>
  );
}

export function SurahBanner({ id }) {
  const m = SURAHS[id - 1];
  return (
    <div className="sbanner">
      <span className="sbanner-orn">
        <Orn />
      </span>
      <span className="sbanner-mid">
        <b>{surahBn(id)}</b>
        <small>
          {m.bn} · {bnNum(m.ayahs)} আয়াত · {m.type === 'meccan' ? 'মাক্কি' : 'মাদানি'}
        </small>
      </span>
      <span className="sbanner-orn flip">
        <Orn />
      </span>
    </div>
  );
}

/* ---------- পারা টানা পড়া ---------- */
//
// সুরা ধরে পড়লে একটা শেষ হলে বেরিয়ে গিয়ে আবার ঢুকতে হয়। পারা ধরে পড়ার
// অভ্যাসটা অন্যরকম — ফাতিহা শেষ হলে বাকারা এমনিতেই এসে যায়, থামতে হয় না।
// তাই এখানে পারার সবগুলো আয়াত একটানা, সুরা বদলালে মাঝখানে নামের ফলক।
//
// উপরের পট্টিটা স্ক্রল করার সাথে সাথে বলে দেয় এখন কোন সুরার কোন আয়াতে আছি।

export default function JuzReader({ juz, qari, onBack, onGo, marks, busy, onToggle, onWholeJuz }) {
  const [pages, setPages] = useState(null);
  const [error, setError] = useState('');
  const [shown, setShown] = useState(CHUNK);
  const [at, setAt] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [loading, setLoading] = useState(null);
  const [audioMsg, setAudioMsg] = useState('');
  const audioRef = useRef(null);
  const tailRef = useRef(null);
  const listRef = useRef(null);

  const parts = useMemo(() => juzParts(juz), [juz]);

  useEffect(() => {
    let alive = true;
    setPages(null);
    setError('');
    setShown(CHUNK);
    setAt(null);
    Promise.all(
      parts.map((x) =>
        fetch('/quran/' + x.id + '.json')
          .then((r) => {
            if (!r.ok) throw new Error('load');
            return r.json();
          })
          .then((d) => ({
            id: x.id,
            verses: d.verses.filter((v) => v.id >= x.from && v.id <= x.to),
          }))
      )
    )
      .then((got) => {
        if (alive) setPages(got);
      })
      .catch(() => {
        if (alive) setError('পারাটা আনা গেল না। নেট দেখে আবার চেষ্টা করুন।');
      });
    return () => {
      alive = false;
    };
  }, [juz, parts]);

  // সবগুলো আয়াত একটানা, কিন্তু কোনটা কোন সুরার সেটা সাথে থাকে
  const flat = useMemo(() => {
    if (!pages) return [];
    const out = [];
    pages.forEach((p) => p.verses.forEach((v, i) => out.push({ surah: p.id, v, first: i === 0 })));
    return out;
  }, [pages]);

  const visible = flat.slice(0, shown);

  // উচ্চারণ কেবল যেটা পর্দায় এসেছে তারটাই, আর একবার বানালে জমা থাকে
  const cacheRef = useRef({ juz: null, map: null });
  if (cacheRef.current.juz !== juz) cacheRef.current = { juz, map: new Map() };
  const uccharonOf = (surah, v) => {
    const key = surah + ':' + v.id;
    const box = cacheRef.current.map;
    const hit = box.get(key);
    if (hit !== undefined) return hit;
    const made = toBanglaUccharon(v.text, surah, v.id);
    box.set(key, made);
    return made;
  };

  useEffect(() => {
    const node = tailRef.current;
    if (!node || shown >= flat.length) return undefined;
    const io = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) setShown((n) => Math.min(n + CHUNK, flat.length));
      },
      { rootMargin: '700px' }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [flat.length, shown]);

  // উপরের পট্টির জন্য: পাতার মাথার ঠিক নিচে সরু একটা ফালি ধরে নিই, ওখানে যে
  // আয়াতটা পড়ে সেটাই "এখন এখানে"। scroll ঘটনা শোনার চেয়ে এটা সস্তা।
  useEffect(() => {
    const box = listRef.current;
    if (!box || !visible.length) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (!hit) return;
        const s = Number(hit.target.dataset.surah);
        const a = Number(hit.target.dataset.ayah);
        setAt((old) => (old && old.surah === s && old.ayah === a ? old : { surah: s, ayah: a }));
      },
      { rootMargin: '-104px 0px -76% 0px' }
    );
    box.querySelectorAll('.ayah[data-ayah]').forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [visible.length]);

  function playAyah(surah, ayah) {
    const el = audioRef.current;
    const key = surah + ':' + ayah;
    if (!el) return;
    if (playing === key) {
      el.pause();
      setPlaying(null);
      return;
    }
    setAudioMsg('');
    setLoading(key);
    el.src = ayahAudioUrl(qari, globalAyah(surah, ayah));
    el.play()
      .then(() => {
        setPlaying(key);
        setLoading(null);
      })
      .catch(() => {
        setLoading(null);
        setAudioMsg('তিলাওয়াতটা বাজানো গেল না — নেট দেখে আবার চেষ্টা করুন');
      });
  }

  const here = at || (flat[0] ? { surah: flat[0].surah, ayah: flat[0].v.id } : null);
  const name = JUZ_NAMES[juz - 1];
  const done = flat.length > 0 && flat.every((x) => (marks[x.surah] || []).includes(x.v.id));

  return (
    <>
      <div className="jread-head">
        <button type="button" className="nav" onClick={onBack} aria-label="পারার তালিকায় ফিরুন">
          <ListIcon size={17} />
        </button>
        <div className="jread-title">
          <strong>পারা {bnNum(juz)}</strong>
          <span>
            {name[0]}
            {here ? ` · ${surahBn(here.surah)} · আয়াত ${bnNum(here.ayah)}` : ''}
          </span>
        </div>
        <span className="jread-ar">{name[1]}</span>
      </div>

      <audio ref={audioRef} preload="none" onEnded={() => setPlaying(null)} />
      {audioMsg ? (
        <div className="auth-error" style={{ marginTop: 10 }}>
          {audioMsg}
        </div>
      ) : null}
      {error ? (
        <div className="empty-note" style={{ marginTop: 14 }}>
          {error}
        </div>
      ) : null}
      {!pages && !error ? (
        <div className="empty-note" style={{ marginTop: 14 }}>
          পারাটা খোলা হচ্ছে…
        </div>
      ) : null}

      {pages ? (
        <div className="ayah-list" ref={listRef}>
          {visible.map(({ surah, v, first }) => {
            const key = surah + ':' + v.id;
            const on = (marks[surah] || []).includes(v.id);
            return (
              <div key={key}>
                {first ? <SurahBanner id={surah} /> : null}
                {first && surah !== 1 && surah !== 9 && v.id === 1 ? (
                  <p className="bismillah">بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</p>
                ) : null}

                <div className={'ayah' + (on ? ' read' : '')} data-surah={surah} data-ayah={v.id}>
                  <div className="ayah-top">
                    <span className="ayah-no">
                      {bnNum(surah)}:{bnNum(v.id)}
                    </span>
                    <div className="ayah-acts">
                      <button
                        type="button"
                        className={'ayah-play' + (playing === key ? ' on' : '')}
                        aria-label={playing === key ? 'থামান' : 'তিলাওয়াত শুনুন'}
                        onClick={() => playAyah(surah, v.id)}
                      >
                        {loading === key ? (
                          <SpinIcon />
                        ) : playing === key ? (
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
                        onClick={() => onToggle(surah, v.id, !on)}
                      >
                        <CheckIcon size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="ayah-ar">{v.text}</p>
                  <p className="ayah-tr">{uccharonOf(surah, v)}</p>
                  <p className="ayah-bn">{v.translation}</p>
                </div>
              </div>
            );
          })}

          {shown < flat.length ? (
            <div ref={tailRef} className="ayah-more">
              <button type="button" className="btn wide" onClick={() => setShown(flat.length)}>
                বাকি {bnNum(flat.length - shown)} আয়াত দেখুন
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {pages && shown >= flat.length ? (
        <>
          <div className="surah-end" aria-hidden="true">
            <i />
            <span>۞</span>
            <i />
          </div>

          <button
            type="button"
            className={'btn wide' + (done ? '' : ' primary')}
            disabled={busy}
            onClick={() => onWholeJuz(parts, !done)}
          >
            {done ? 'পুরো পারার টিক তুলে নিন' : 'পুরো পারা পড়া হয়েছে'}
          </button>

          <div className="surah-pager" style={{ marginTop: 8 }}>
            {juz > 1 ? (
              <button type="button" className="pager" onClick={() => onGo(juz - 1)}>
                <ChevronIcon dir="left" size={16} />
                <span>
                  <small>আগের পারা</small>
                  <b>{JUZ_NAMES[juz - 2][0]}</b>
                </span>
              </button>
            ) : (
              <span className="pager empty">এটাই প্রথম পারা</span>
            )}

            {juz < 30 ? (
              <button type="button" className="pager next" onClick={() => onGo(juz + 1)}>
                <span>
                  <small>পরের পারা</small>
                  <b>{JUZ_NAMES[juz][0]}</b>
                </span>
                <ChevronIcon dir="right" size={16} />
              </button>
            ) : (
              <span className="pager empty">কুরআন এখানেই শেষ</span>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
