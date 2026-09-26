'use client';

import { useState } from 'react';
import { PRAYERS, dayTotal, dayCounts, withAutoMissed } from '../lib/prayers';
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

function emptyCounts() {
  return { prayed: 0, qaza: 0, missed: 0 };
}

/* ---------- মাস শেষে জরিমানা মেটানো ---------- */
// সংখ্যাগুলো সার্ভারের (/api/settle) — দুজনের খাতা মিলিয়ে সেখানেই গোনা হয়।

function SettleCard({ m, meName, partnerName, onSettle }) {
  const [busy, setBusy] = useState(false);
  const name = (x) => (x === 'me' ? meName : partnerName);
  const other = (x) => (x === 'me' ? partnerName : meName);
  const owe = (payer, amount) => `${name(payer)} ${other(payer)}-কে ৳${bnNum(amount)} দেবেন`;

  async function run(paid) {
    setBusy(true);
    await onSettle(m.month, paid);
    setBusy(false);
  }

  const paidOn = m.paid
    ? new Date(m.paid.at).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long' })
    : '';

  return (
    <div className={'settle ' + m.status}>
      <div className="settle-head">
        <b>মাসের হিসাব মেটানো</b>
        <span className="settle-pill">
          {{ running: 'চলতি', due: 'বাকি', paid: 'পরিশোধিত', changed: 'আবার মেলাতে হবে', even: 'সমান' }[
            m.status
          ]}
        </span>
      </div>

      {m.status === 'running' ? (
        <p>
          {m.payer ? <>এ পর্যন্ত: <b>{owe(m.payer, m.amount)}</b></> : 'এ পর্যন্ত দুজনের জরিমানা সমান'}
          <small>মাস শেষ হলে চূড়ান্ত হবে, তারপর পরের মাস আবার শূন্য থেকে।</small>
        </p>
      ) : null}

      {m.status === 'even' ? <p>দুজনের জরিমানা সমান — এই মাসে দেওয়া-নেওয়ার কিছু নেই।</p> : null}

      {m.status === 'due' ? (
        <>
          <p>
            <b>{owe(m.payer, m.amount)}</b>
            <small>দেওয়া হয়ে গেলে নিচে চাপুন — দুজনের যে কেউ লিখতে পারেন।</small>
          </p>
          <button type="button" className="btn primary wide" disabled={busy} onClick={() => run(true)}>
            পরিশোধ হয়েছে
          </button>
        </>
      ) : null}

      {m.status === 'paid' ? (
        <p>
          <b>{owe(m.payer, m.amount)}</b> — দেওয়া হয়ে গেছে।
          <small>
            {paidOn} · {name(m.paid.by)} লিখেছেন ·{' '}
            <button type="button" className="link-btn" disabled={busy} onClick={() => run(false)}>
              বাতিল করুন
            </button>
          </small>
        </p>
      ) : null}

      {m.status === 'changed' ? (
        <>
          <p>
            পরিশোধের পর এই মাসের কোনো দিনের হিসাব বদলেছে।
            <small>
              তখন লেখা হয়েছিল: {m.paid.payer ? owe(m.paid.payer, m.paid.amount) : 'কিছু দেওয়ার ছিল না'}।
            </small>
            <small>
              এখন: <b>{m.payer ? owe(m.payer, m.amount) : 'দুজনের সমান'}</b>।
            </small>
          </p>
          {m.amount > 0 ? (
            <button type="button" className="btn primary wide" disabled={busy} onClick={() => run(true)}>
              এখনকার হিসাবে পরিশোধ হয়েছে
            </button>
          ) : (
            <button type="button" className="btn wide" disabled={busy} onClick={() => run(false)}>
              পুরনো পরিশোধ মুছে দিন
            </button>
          )}
        </>
      ) : null}
    </div>
  );
}

export default function MonthReport({
  records,
  partner,
  meName,
  missedFrom,
  settle,
  onSettle,
  monthReq,
  dateKey,
  onSelectDay,
}) {
  // কোন মাস দেখছি তা আলাদা করে ধরে রাখি, উপরের তারিখ থেকে স্বাধীন
  const [anchor, setAnchor] = useState(() => ymOf(dateKey));
  const [seenDate, setSeenDate] = useState(dateKey);
  const [seenReq, setSeenReq] = useState(monthReq);
  const [who, setWho] = useState('me');

  if (seenDate !== dateKey) {
    if (ymOf(dateKey) !== ymOf(seenDate)) setAnchor(ymOf(dateKey));
    setSeenDate(dateKey);
  }

  // উপরের "বাকি" খবরে চাপ দিলে সেই মাসে চলে আসি
  if (monthReq !== seenReq) {
    if (monthReq && monthReq.ym) setAnchor(monthReq.ym);
    setSeenReq(monthReq);
  }

  const partnerDays = partner && partner.days ? partner.days : null;
  const sides = partnerDays
    ? [
        { key: 'me', name: meName, days: records, from: missedFrom },
        { key: 'partner', name: partner.name, days: partnerDays, from: partner.missedFrom || null },
      ]
    : [{ key: 'me', name: meName, days: records, from: missedFrom }];

  const today = todayKey();
  const keys = monthKeysOf(anchor);
  const elapsed = keys.filter((k) => k <= today);
  const atLatest = anchor >= currentYm();

  // প্রতিটি দিকের মোট টাকা, ওয়াক্তের গোনা, আর ওয়াক্ত ধরে ভাগ
  const stats = sides.map((side) => {
    let total = 0;
    const counts = emptyCounts();
    const perWaqt = {};
    PRAYERS.forEach((p) => {
      perWaqt[p.id] = emptyCounts();
    });
    let written = 0;

    keys.forEach((k) => {
      // "লেখা আছে" গোনা হয় যা সত্যিই লেখা; জরিমানা আর গোনা হয় পেরোনো দিনের
      // না-লেখাগুলো "পড়েনি" ধরে (lib/prayers.js)
      const raw = side.days[k];
      if (raw && PRAYERS.some((p) => raw[p.id]) && k <= today) written += 1;
      const rec = withAutoMissed(raw, k, today, side.from);
      if (!rec) return;
      total += dayTotal(rec);
      const c = dayCounts(rec);
      counts.prayed += c.prayed;
      counts.qaza += c.qaza;
      counts.missed += c.missed;
      PRAYERS.forEach((p) => {
        const s = rec[p.id];
        if (s && perWaqt[p.id][s] !== undefined) perWaqt[p.id][s] += 1;
      });
    });

    return { ...side, total, counts, perWaqt, written };
  });

  const anyWritten = stats.some((s) => s.written > 0 || s.total > 0);
  const settleMonth = settle ? settle.months.find((x) => x.month === anchor) : null;
  const shown = stats.find((s) => s.key === who) || stats[0];
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

      <div className={'month-total' + (stats.length === 1 ? ' one' : '')}>
        {stats.map((s) => (
          <div className="total-box" key={s.key}>
            <div className="label">{s.name}</div>
            <div className={'value' + (s.total === 0 ? ' zero' : '')}>৳ {bnNum(s.total)}</div>
            <div className="tally">
              <span className="good">পড়েছে {bnNum(s.counts.prayed)}</span>
              <span className="warn">কাজা {bnNum(s.counts.qaza)}</span>
              <span className="bad">বাদ {bnNum(s.counts.missed)}</span>
            </div>
          </div>
        ))}
      </div>

      {settleMonth && partner ? (
        <SettleCard m={settleMonth} meName={meName} partnerName={partner.name} onSettle={onSettle} />
      ) : null}

      {!anyWritten ? (
        <div className="empty-note">
          {formatYm(anchor)} মাসে এখনো কিছু লেখা হয়নি। উপরের কার্ডগুলোতে ট্যাপ করলেই হিসাব জমা হতে
          থাকবে।
        </div>
      ) : (
        <>
          <div className="section-title">কোন ওয়াক্তে কেমন গেল</div>
          <div className="waqt-table">
            <div className="waqt-row head" style={{ gridTemplateColumns: cols(stats.length) }}>
              <span className="wq-name">ওয়াক্ত</span>
              {stats.map((s) => (
                <span className="wq-cell" key={s.key}>
                  {s.name}
                </span>
              ))}
            </div>
            {PRAYERS.map((p) => (
              <div className="waqt-row" key={p.id} style={{ gridTemplateColumns: cols(stats.length) }}>
                <span className="wq-name">
                  <b>{p.bn}</b>
                  <small>{p.waqt}</small>
                </span>
                {stats.map((s) => {
                  const c = s.perWaqt[p.id];
                  return (
                    <span className="wq-cell" key={s.key}>
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

      {stats.length > 1 ? (
        <div className="who-tabs" role="tablist">
          {stats.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={who === s.key}
              className={'who-tab' + (who === s.key ? ' on' : '')}
              onClick={() => setWho(s.key)}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}

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
            const raw = shown.days[k] || null;
            const rec = withAutoMissed(raw, k, today, shown.from);
            const future = k > today;
            const total = dayTotal(rec);
            const marked = rec && PRAYERS.some((p) => rec[p.id]);
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
                    <i
                      key={p.id}
                      className={
                        'seg ' + ((rec && rec[p.id]) || 'none') + (rec && rec[p.id] && !(raw && raw[p.id]) ? ' auto' : '')
                      }
                    />
                  ))}
                </span>
                <span className={'cal-tk' + (total === 0 ? ' zero' : '')}>
                  {marked ? '৳' + bnNum(total) : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="month-foot">
        {formatYm(anchor)} মাসের {bnNum(elapsed.length)} দিনের মধ্যে {bnNum(stats[0].written)} দিনের
        হিসাব লেখা আছে
      </div>
    </>
  );
}

// এক জন না দুই জন — তার উপর ছকের ঘরের মাপ
function cols(n) {
  return n > 1 ? '1fr 92px 92px' : '1fr 92px';
}
