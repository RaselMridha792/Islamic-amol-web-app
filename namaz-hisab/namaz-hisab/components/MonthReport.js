'use client';

import { useState } from 'react';
import { PRAYERS, dayTotal, dayCounts } from '../lib/prayers';
import {
  BN_DAYS_SHORT,
  bnNum,
  currentYm,
  firstWeekdayOf,
  formatYm,
  monthKeysOf,
  shiftMonth,
  todayKey,
  ymOf,
} from '../lib/store';
import { ChevronIcon } from './Icons';

const PIDS = ['p1', 'p2'];

function emptyCounts() {
  return { prayed: 0, qaza: 0, missed: 0 };
}

export default function MonthReport({ records, dateKey, people, onSelectDay }) {
  // কোন মাস দেখছি তা আলাদা করে ধরে রাখি, উপরের তারিখ থেকে স্বাধীন
  const [anchor, setAnchor] = useState(() => ymOf(dateKey));
  const [seenDate, setSeenDate] = useState(dateKey);
  const [who, setWho] = useState('p1');

  // উপরের তারিখ অন্য মাসে চলে গেলে খাতাও সেই মাসে যাক
  if (seenDate !== dateKey) {
    if (ymOf(dateKey) !== ymOf(seenDate)) setAnchor(ymOf(dateKey));
    setSeenDate(dateKey);
  }

  const today = todayKey();
  const nowYm = currentYm();
  const keys = monthKeysOf(anchor);
  const elapsed = keys.filter((k) => k <= today);
  const atLatest = anchor >= nowYm;

  const written = elapsed.filter((k) => {
    const rec = records[k];
    if (!rec) return false;
    return PIDS.some((id) => rec[id] && PRAYERS.some((p) => rec[id][p.id]));
  });

  // মাসের মোট টাকা আর মোট ওয়াক্তের গোনা
  const totals = { p1: 0, p2: 0 };
  const counts = { p1: emptyCounts(), p2: emptyCounts() };
  // প্রতি ওয়াক্তে কে কেমন করল
  const perWaqt = {};
  PRAYERS.forEach((p) => {
    perWaqt[p.id] = { p1: emptyCounts(), p2: emptyCounts() };
  });

  keys.forEach((k) => {
    const rec = records[k];
    if (!rec) return;
    PIDS.forEach((id) => {
      const one = rec[id];
      if (!one) return;
      totals[id] += dayTotal(one);
      const c = dayCounts(one);
      counts[id].prayed += c.prayed;
      counts[id].qaza += c.qaza;
      counts[id].missed += c.missed;
      PRAYERS.forEach((p) => {
        const s = one[p.id];
        if (s && perWaqt[p.id][id][s] !== undefined) perWaqt[p.id][id][s] += 1;
      });
    });
  });

  const lead = firstWeekdayOf(anchor);

  return (
    <>
      <div className="month-head">
        <button
          type="button"
          className="nav"
          onClick={() => setAnchor(shiftMonth(anchor, -1))}
          aria-label="আগের মাস"
        >
          <ChevronIcon dir="left" />
        </button>
        <div className="month-title">
          <strong>{formatYm(anchor)}</strong>
          <span>মাসের পুরো হিসাব</span>
        </div>
        <button
          type="button"
          className="nav"
          onClick={() => setAnchor(shiftMonth(anchor, 1))}
          disabled={atLatest}
          aria-label="পরের মাস"
        >
          <ChevronIcon dir="right" />
        </button>
      </div>

      <div className="month-total">
        {PIDS.map((id) => (
          <div className="total-box" key={id}>
            <div className="label">{people[id].name}</div>
            <div className={'value' + (totals[id] === 0 ? ' zero' : '')}>৳ {bnNum(totals[id])}</div>
            <div className="tally">
              <span className="good">পড়েছে {bnNum(counts[id].prayed)}</span>
              <span className="warn">কাজা {bnNum(counts[id].qaza)}</span>
              <span className="bad">বাদ {bnNum(counts[id].missed)}</span>
            </div>
          </div>
        ))}
      </div>

      {written.length === 0 ? (
        <div className="empty-note">
          {formatYm(anchor)} মাসে এখনো কিছু লেখা হয়নি। উপরের কার্ডগুলোতে ট্যাপ করলেই হিসাব জমা হতে থাকবে।
        </div>
      ) : (
        <>
          <div className="section-title">কোন ওয়াক্তে কেমন গেল</div>
          <div className="waqt-table">
            <div className="waqt-row head">
              <span className="wq-name">ওয়াক্ত</span>
              <span className="wq-cell">{people.p1.name}</span>
              <span className="wq-cell">{people.p2.name}</span>
            </div>
            {PRAYERS.map((p) => (
              <div className="waqt-row" key={p.id}>
                <span className="wq-name">
                  <b>{p.bn}</b>
                  <small>{p.waqt}</small>
                </span>
                {PIDS.map((id) => {
                  const c = perWaqt[p.id][id];
                  return (
                    <span className="wq-cell" key={id}>
                      <i className="good" title="পড়েছে">{bnNum(c.prayed)}</i>
                      <i className="warn" title="কাজা">{bnNum(c.qaza)}</i>
                      <i className="bad" title="পড়েনি">{bnNum(c.missed)}</i>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="waqt-legend">
            <span><i className="dot good" />পড়েছে</span>
            <span><i className="dot warn" />কাজা</span>
            <span><i className="dot bad" />পড়েনি</span>
          </div>
        </>
      )}

      <div className="section-title">দিনে দিনে</div>

      <div className="who-tabs" role="tablist">
        {PIDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={who === id}
            className={'who-tab' + (who === id ? ' on' : '')}
            onClick={() => setWho(id)}
          >
            {people[id].name}
          </button>
        ))}
      </div>

      <div className="calendar">
        <div className="cal-week">
          {BN_DAYS_SHORT.map((d) => (
            <span className="cal-wd" key={d}>{d}</span>
          ))}
        </div>
        <div className="cal-grid">
          {Array.from({ length: lead }).map((_, i) => (
            <span className="cal-cell blank" key={'b' + i} />
          ))}
          {keys.map((k) => {
            const rec = (records[k] && records[k][who]) || null;
            const future = k > today;
            const total = dayTotal(rec);
            return (
              <button
                key={k}
                type="button"
                className={
                  'cal-cell' +
                  (k === dateKey ? ' active' : '') +
                  (k === today ? ' today' : '') +
                  (future ? ' future' : '')
                }
                disabled={future}
                onClick={() => onSelectDay(k)}
                aria-label={k + ' — ৳ ' + total}
              >
                <span className="cal-d">{bnNum(Number(k.slice(8)))}</span>
                <span className="cal-bars">
                  {PRAYERS.map((p) => (
                    <i key={p.id} className={'seg ' + ((rec && rec[p.id]) || 'none')} />
                  ))}
                </span>
                <span className={'cal-tk' + (total === 0 ? ' zero' : '')}>
                  {rec && Object.keys(rec).length ? '৳' + bnNum(total) : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="month-foot">
        {formatYm(anchor)} মাসের {bnNum(elapsed.length)} দিনের মধ্যে {bnNum(written.length)} দিনের হিসাব লেখা আছে
      </div>
    </>
  );
}
