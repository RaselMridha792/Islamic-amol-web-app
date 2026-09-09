'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHead from './PageHead';
import { ChevronIcon, CheckIcon } from './Icons';
import { SURAHS } from '../lib/quranMeta';
import { bnNum } from '../lib/store';
import { getQuran, markQuran } from '../lib/cloud';

const EMPTY_SUMMARY = { ayahs: 0, juzDone: 0, juzTotal: 30 };

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
                <b>{s.tr}</b>
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

function SurahView({ id, onBack, readAyahs, onToggle, onWholeSurah, busy }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const meta = SURAHS[id - 1];

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

  return (
    <>
      <div className="surah-head">
        <button type="button" className="nav" onClick={onBack} aria-label="তালিকায় ফিরুন">
          <ChevronIcon dir="left" />
        </button>
        <div className="month-title">
          <strong>{meta.tr}</strong>
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

      {data ? (
        <div className="ayah-list">
          {data.verses.map((v) => {
            const on = readSet.has(v.id);
            return (
              <div key={v.id} className={'ayah' + (on ? ' read' : '')}>
                <div className="ayah-top">
                  <span className="ayah-no">{bnNum(v.id)}</span>
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
                <p className="ayah-ar">{v.text}</p>
                <p className="ayah-tr">{v.transliteration}</p>
                <p className="ayah-bn">{v.translation}</p>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

/* ---------- পুরোটা ---------- */

export default function QuranReader() {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
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
  }, [loadTop]);

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
      // আগে পর্দায় দেখাই, তারপর সার্ভারে পাঠাই — টিক দিতে অপেক্ষা করতে হয় না
      setReadAyahs((prev) => {
        const set = new Set(prev);
        ayahs.forEach((a) => (read ? set.add(a) : set.delete(a)));
        return Array.from(set);
      });
      try {
        const res = await markQuran(open, ayahs, read);
        setSummary(res.summary || EMPTY_SUMMARY);
        setReadBySurah((m) => {
          const next = { ...m };
          const cur = new Set(readAyahs);
          ayahs.forEach((a) => (read ? cur.add(a) : cur.delete(a)));
          next[open] = cur.size;
          return next;
        });
      } catch (err) {
        setMsg('হিসাবটা সার্ভারে রাখা গেল না, আবার চেষ্টা করুন');
      }
      setBusy(false);
    },
    [open, readAyahs]
  );

  return (
    <main className="shell">
      <PageHead title="কুরআন" sub="পড়ুন আর কতটুকু হলো দেখুন" />
      <Progress summary={summary} />
      {msg ? <div className="auth-error">{msg}</div> : null}

      {open ? (
        <SurahView
          id={open}
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
