'use client';

import Avatar from './Avatar';
import { MosqueIcon } from './Icons';
import { STATUS_MAP, STATUSES, totalRakat } from '../lib/prayers';
import { bnNum } from '../lib/store';

// আমার দিক — এখানেই ট্যাপ করে হিসাব লেখা হয়
function MySide({ me, chosen, onPick }) {
  return (
    <div className="side">
      <div className="side-head">
        <Avatar person={me} small />
        <span>{me.name}</span>
      </div>
      {STATUSES.map((s) => {
        const on = chosen === s.id;
        return (
          <button
            key={s.id}
            type="button"
            className={'choice ' + s.tone + (on ? ' on' : '')}
            aria-pressed={on}
            onClick={() => onPick(s.id)}
          >
            <span className="dot" />
            {s.short}
            <span className="cost">{s.fine === 0 ? '৳০' : '৳' + bnNum(s.fine)}</span>
          </button>
        );
      })}
    </div>
  );
}

// সঙ্গীর দিক — শুধু দেখার, ট্যাপ করা যায় না
function PartnerSide({ partner, chosen }) {
  const s = chosen ? STATUS_MAP[chosen] : null;
  return (
    <div className="side">
      <div className="side-head">
        <Avatar person={partner} small />
        <span>{partner.name}</span>
      </div>
      <div className={'peek' + (s ? ' ' + s.tone : ' none')}>
        <span className="dot" />
        <b>{s ? s.short : 'এখনো লেখেনি'}</b>
        {s ? <span className="cost">{s.fine === 0 ? '৳০' : '৳' + bnNum(s.fine)}</span> : null}
      </div>
    </div>
  );
}

export default function PrayerCard({ prayer, me, partner, mine, theirs, onPick }) {
  return (
    <section className="card">
      <header className="card-head">
        <div className="waqt-badge">
          <MosqueIcon />
        </div>
        <div className="card-title">
          <div className="name">{prayer.bn}</div>
          <div className="sub">
            {prayer.waqt} · মোট {bnNum(totalRakat(prayer))} রাকাত
          </div>
        </div>
        <div className="arabic">{prayer.ar}</div>
      </header>

      {/* ওয়াক্তের পুরো রাকাত — শুধু ফরজ নয়, সুন্নত-নফল-বিতরসহ */}
      <div className="rakat-row">
        {prayer.parts.map((part, i) => (
          <span key={i} className={'rakat-chip ' + part.tone}>
            {bnNum(part.n)} {part.kind}
          </span>
        ))}
      </div>

      <div className={'split' + (partner ? '' : ' solo')}>
        <MySide
          me={me}
          chosen={mine ? mine[prayer.id] : undefined}
          onPick={(statusId) => onPick(prayer.id, statusId)}
        />
        {partner ? (
          <>
            <div className="split-line" />
            <PartnerSide partner={partner} chosen={theirs ? theirs[prayer.id] : undefined} />
          </>
        ) : null}
      </div>
    </section>
  );
}
