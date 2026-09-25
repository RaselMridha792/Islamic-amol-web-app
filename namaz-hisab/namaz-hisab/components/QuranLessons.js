'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { ChevronIcon, ListIcon, PlayIcon, PauseIcon, SpinIcon } from './Icons';
import { LESSONS, TAJWEED_CATS } from '../lib/content/tajweed';
import { audioUrlByNumber } from '../lib/recite';
import { surahBn } from '../lib/content/surahNames';
import { bnNum } from '../lib/store';

// সহীহভাবে পড়া শেখার পাঠ — কুরআনের পাতার "শিখুন" ট্যাব।
// লেখাগুলো scripts/buildTajweed.mjs থেকে আসে।

// উদাহরণ বাজে শায়খ মাহমুদ খলিল আল-হুসারির তিলাওয়াতে — ধীর আর মাপা, প্রতিটি
// নিয়ম আলাদা করে কানে ধরা যায়। তাজবীদ শেখানোয় তাঁর রেকর্ডই সবচেয়ে বেশি চলে,
// তাই পড়ার পাতায় যে কারীই বাছা থাকুক, এখানে এটাই।
const TEACHER = 'ar.husary';

// বাংলা লেখার মাঝে আরবি অংশগুলো আলাদা করে আরবি ফন্টে বসাই — নইলে বাংলা
// ফন্টের পাশে হরকতগুলো ছোট আর এলোমেলো দেখায়
const AR = '؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿';
const AR_RUN = new RegExp(`([${AR}]+(?:\\s+[${AR}]+)*)`);

function withArabic(text) {
  return text.split(AR_RUN).map((part, i) =>
    i % 2 ? (
      <span key={i} className="ar-inline" dir="rtl">{part}</span>
    ) : (
      part
    )
  );
}

// শুধু টানা দাগ আর কুরআনের থামার চিহ্ন, কোনো হরফ নেই
const SIGN_ONLY = /^[ـ\sۖ-ۭ]+$/;

const indexOf = (id) => LESSONS.findIndex((l) => l.id === id);

/* ---------- পাঠের তালিকা ---------- */

function LessonList({ onOpen }) {
  let n = 0;
  return (
    <>
      <div className="lesson-intro">
        উচ্চারণ কানে শুনেই পাকা হয়। প্রতিটি পাঠে কুরআন থেকে উদাহরণ আছে — তিলাওয়াত
        শুনুন, সাথে সাথে নিজে বলুন। সম্ভব হলে একজন কারী বা উস্তাদকে শুনিয়ে নিন।
      </div>

      {TAJWEED_CATS.map((c) => {
        const items = LESSONS.filter((l) => l.cat === c.id);
        if (!items.length) return null;
        return (
          <section key={c.id} className="lesson-cat">
            <h2>{c.name}</h2>
            <div className="surah-list">
              {items.map((l) => {
                n += 1;
                return (
                  <button key={l.id} type="button" className="surah-row" onClick={() => onOpen(l.id)}>
                    <span className="surah-num">{bnNum(n)}</span>
                    <span className="surah-mid">
                      <b>{l.title}</b>
                      <small>{withArabic(l.sub)}</small>
                    </span>
                    <span className="lesson-go" aria-hidden="true">
                      <ChevronIcon dir="right" size={16} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}

/* ---------- একটা উদাহরণ ---------- */

function Example({ ex, state, onPlay }) {
  const hi = new Set(ex.hi);
  const words = ex.ar.split(' ');
  return (
    <div className="ayah lesson-ex">
      <div className="ayah-top">
        <span className="ayah-no">
          সুরা {surahBn(ex.s)} · {bnNum(ex.a)}
        </span>
        <button
          type="button"
          className={'ayah-play' + (state === 'on' ? ' on' : '')}
          aria-label={state === 'on' ? 'থামান' : 'তিলাওয়াত শুনুন'}
          onClick={onPlay}
        >
          {state === 'loading' ? <SpinIcon /> : state === 'on' ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>
      {/* পুরো শব্দ ধরে রঙ করি — শব্দের মাঝখানে ভাঙলে আরবি হরফের জোড়া ছিঁড়ে যায় */}
      <p className="ayah-ar">
        {words.map((w, i) => (
          <Fragment key={i}>
            {i ? ' ' : ''}
            {hi.has(i + 1) ? <mark className="tj-hi">{w}</mark> : w}
          </Fragment>
        ))}
      </p>
      <p className="ex-bn">{ex.bn}</p>
      <p className="ex-note">{withArabic(ex.note)}</p>
    </div>
  );
}

/* ---------- একটা পাঠ ---------- */

function LessonView({ lesson, onBack, onGo, stateOf, onPlay }) {
  const i = indexOf(lesson.id);
  const prev = i > 0 ? LESSONS[i - 1] : null;
  const next = i < LESSONS.length - 1 ? LESSONS[i + 1] : null;
  const cat = TAJWEED_CATS.find((c) => c.id === lesson.cat);
  const voice = stateOf('voice');

  return (
    <>
      <div className="surah-head">
        <button type="button" className="nav" onClick={onBack} aria-label="পাঠের তালিকায় ফিরুন">
          <ListIcon size={17} />
        </button>
        <button
          type="button"
          className="nav"
          disabled={!prev}
          onClick={() => prev && onGo(prev.id)}
          aria-label={prev ? 'আগের পাঠ — ' + prev.title : 'এটাই প্রথম পাঠ'}
        >
          <ChevronIcon dir="left" />
        </button>
        <div className="month-title">
          <strong>{lesson.title}</strong>
          <span>
            পাঠ {bnNum(i + 1)}/{bnNum(LESSONS.length)} · {cat ? cat.name : ''}
          </span>
        </div>
        <button
          type="button"
          className="nav"
          disabled={!next}
          onClick={() => next && onGo(next.id)}
          aria-label={next ? 'পরের পাঠ — ' + next.title : 'এটাই শেষ পাঠ'}
        >
          <ChevronIcon dir="right" />
        </button>
      </div>

      {lesson.voice ? (
        <button
          type="button"
          className={'btn wide' + (voice === 'on' ? '' : ' primary')}
          onClick={() => onPlay('voice', lesson.voice)}
        >
          {voice === 'loading' ? <SpinIcon /> : voice === 'on' ? <PauseIcon /> : <PlayIcon />}
          {voice === 'on' ? 'থামান' : 'ব্যাখ্যা শুনুন'}
        </button>
      ) : null}

      <div className="lesson-body">
        {lesson.body.map((p, k) => (
          <p key={k}>{withArabic(p)}</p>
        ))}
      </div>

      {lesson.points ? (
        <div className="lesson-points">
          {lesson.points.map((pt, k) => (
            <div key={k} className="lp">
              {/* থামার চিহ্নগুলো টানা দাগের (ـ) উপরে বসানো — ছোট চিহ্ন, তাই বড় করে */}
              <span className={'lp-k' + (SIGN_ONLY.test(pt.k) ? ' sign' : '')} dir="rtl">{pt.k}</span>
              <span className="lp-v">{withArabic(pt.v)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {lesson.examples.length ? (
        <>
          <h3 className="lesson-sub">উদাহরণ — শুনুন, তারপর নিজে বলুন</h3>
          <div className="ayah-list">
            {lesson.examples.map((ex, k) => {
              const key = 'ex:' + k;
              return (
                <Example
                  key={key}
                  ex={ex}
                  state={stateOf(key)}
                  onPlay={() => onPlay(key, audioUrlByNumber(ex.audio, TEACHER))}
                />
              );
            })}
          </div>
        </>
      ) : null}

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
              <small>আগের পাঠ</small>
              <b>{prev.title}</b>
            </span>
          </button>
        ) : (
          <span className="pager empty">এটাই প্রথম পাঠ</span>
        )}
        {next ? (
          <button type="button" className="pager next" onClick={() => onGo(next.id)}>
            <span>
              <small>পরের পাঠ</small>
              <b>{next.title}</b>
            </span>
            <ChevronIcon dir="right" size={16} />
          </button>
        ) : (
          <span className="pager empty">সব পাঠ শেষ</span>
        )}
      </div>

      <button type="button" className="btn wide" onClick={onBack}>
        পাঠের তালিকায় ফিরুন
      </button>
    </>
  );
}

/* ---------- পুরোটা ---------- */

// কোন পাঠ খোলা, সেটা কুরআনের পাতা ধরে রাখে — অন্য ট্যাব ঘুরে এলে যেন
// একই পাঠেই ফেরা যায়
export default function QuranLessons({ open, onOpen }) {
  const [playing, setPlaying] = useState(null);
  const [loading, setLoading] = useState(null);
  const [msg, setMsg] = useState('');
  const audioRef = useRef(null);
  const lesson = open ? LESSONS[indexOf(open)] : null;

  // পাঠ বদলালে বা পাতা ছাড়লে যা বাজছিল থামাই
  useEffect(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute('src');
    }
    setPlaying(null);
    setLoading(null);
    setMsg('');
    return () => {
      if (a) {
        a.pause();
        a.removeAttribute('src');
      }
    };
  }, [open]);

  function play(key, url) {
    const a = audioRef.current;
    if (!a) return;
    if (playing === key) {
      a.pause();
      setPlaying(null);
      return;
    }
    setLoading(key);
    setMsg('');
    a.src = url;
    a.play()
      .then(() => {
        setPlaying(key);
        setLoading(null);
      })
      .catch(() => {
        setLoading(null);
        setPlaying(null);
        setMsg('অডিওটা চালানো গেল না — নেট দেখে আবার চেষ্টা করুন।');
      });
  }

  const stateOf = (key) => (loading === key ? 'loading' : playing === key ? 'on' : '');

  function go(id) {
    onOpen(id);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  }

  return (
    <>
      <audio ref={audioRef} preload="none" onEnded={() => setPlaying(null)} />
      {msg ? <div className="auth-error">{msg}</div> : null}
      {lesson ? (
        <LessonView
          lesson={lesson}
          onBack={() => onOpen(null)}
          onGo={go}
          stateOf={stateOf}
          onPlay={play}
        />
      ) : (
        <LessonList onOpen={go} />
      )}
    </>
  );
}
