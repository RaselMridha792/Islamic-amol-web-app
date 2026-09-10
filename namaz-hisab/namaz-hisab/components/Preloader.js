'use client';

import { useEffect, useState } from 'react';
import { CrescentIcon } from './Icons';
import { loadMeCache, loadPartnerCache } from '../lib/store';

// অ্যাপ খোলার মুখের পর্দা।
//
// লেখা দিয়ে "অপেক্ষা করুন" বলার চেয়ে দুজনের মুখ দেখানোই ভালো লাগে — এটা তো
// দুজনের খাতা। ছবিগুলো আগের বারেরই, ব্রাউজারে জমানো, তাই সার্ভারের উত্তরের
// অপেক্ষা না করেই সাথে সাথে ফোটে। প্রথমবার ঢোকার সময় জমানো কিছু থাকে না —
// তখন শুধু চাঁদটাই থাকে, তাতেও পর্দা ফাঁকা লাগে না।

function Face({ person, delay }) {
  const letter = ((person && person.name) || '').trim().charAt(0);
  return (
    <div className="pre-face" style={{ animationDelay: delay }}>
      {person && person.photo ? (
        <img src={person.photo} alt="" />
      ) : (
        <span aria-hidden="true">{letter || <CrescentIcon size={22} />}</span>
      )}
    </div>
  );
}

export default function Preloader() {
  const [duo, setDuo] = useState(null);

  // localStorage সার্ভারে নেই, তাই পর্দায় আসার পরে পড়ি
  useEffect(() => {
    const me = loadMeCache();
    const partner = loadPartnerCache();
    if (me || partner) setDuo({ me, partner });
  }, []);

  return (
    <main className="preloader" role="status" aria-label="একসাথে দ্বীনের পথে">
      <div className="pre-stage">
        <div className="pre-halo" aria-hidden="true" />

        <div className="pre-duo">
          <Face person={duo && duo.me} delay="0s" />
          <div className="pre-knot" aria-hidden="true">
            <CrescentIcon size={18} />
          </div>
          <Face person={duo && duo.partner} delay=".12s" />
        </div>

        <div className="pre-name">
          <h1>একসাথে দ্বীনের পথে</h1>
          <p>DeenTogether</p>
        </div>

        <div className="pre-beads" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </main>
  );
}
