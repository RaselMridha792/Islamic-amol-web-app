'use client';

import Avatar from './Avatar';
import { MosqueIcon } from './Icons';
import { STATUSES } from '../lib/prayers';
import { bnNum } from '../lib/store';

function Side({ personId, person, chosen, onPick }) {
  return (
    <div className="side">
      <div className="side-head">
        <Avatar person={person} small />
        <span>{person.name}</span>
      </div>
      {STATUSES.map((s) => {
        const on = chosen === s.id;
        return (
          <button
            key={s.id}
            type="button"
            className={'choice ' + s.tone + (on ? ' on' : '')}
            aria-pressed={on}
            onClick={() => onPick(personId, s.id)}
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

export default function PrayerCard({ prayer, people, record, onPick }) {
  return (
    <section className="card">
      <header className="card-head">
        <div className="waqt-badge">
          <MosqueIcon />
        </div>
        <div>
          <div className="name">{prayer.bn}</div>
          <div className="sub">
            {prayer.waqt} · {prayer.rakat}
          </div>
        </div>
        <div className="arabic">{prayer.ar}</div>
      </header>

      <div className="split">
        <Side
          personId="p1"
          person={people.p1}
          chosen={record.p1 ? record.p1[prayer.id] : undefined}
          onPick={(personId, statusId) => onPick(personId, prayer.id, statusId)}
        />
        <div className="split-line" />
        <Side
          personId="p2"
          person={people.p2}
          chosen={record.p2 ? record.p2[prayer.id] : undefined}
          onPick={(personId, statusId) => onPick(personId, prayer.id, statusId)}
        />
      </div>
    </section>
  );
}
