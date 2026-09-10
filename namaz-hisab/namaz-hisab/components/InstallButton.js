'use client';

import { useEffect, useState } from 'react';

// ফোনের হোম স্ক্রিনে অ্যাড করার বোতাম।
//
// ক্রোম/অ্যান্ড্রয়েডে ব্রাউজার নিজেই beforeinstallprompt ঘটনা পাঠায়, ওটা ধরে
// রেখে চাপ দিলে ব্রাউজারের নিজের ডায়ালগ দেখাই। আইফোনের সাফারিতে ওই ঘটনা নেই,
// তাই ওখানে হাতে করার নিয়মটা লিখে দিই।

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function InstallButton({ compact }) {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [showIos, setShowIos] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIos());

    const onPrompt = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // ইতিমধ্যেই হোম স্ক্রিনে চলছে — কিছু দেখানোর দরকার নেই
  if (installed) return null;
  // অ্যান্ড্রয়েডে ব্রাউজার এখনো তৈরি নয়, আর আইফোনও নয় — তখন লুকিয়ে রাখি
  if (!prompt && !ios) return null;

  async function install() {
    if (ios) {
      setShowIos((v) => !v);
      return;
    }
    const p = prompt;
    setPrompt(null);
    try {
      p.prompt();
      await p.userChoice;
    } catch (err) {
      // ব্যবহারকারী না চাইলে কিছু করার নেই
    }
  }

  return (
    <>
      <button
        type="button"
        className={compact ? 'mini-btn' : 'btn wide'}
        onClick={install}
      >
        হোম স্ক্রিনে অ্যাড করুন
      </button>

      {showIos ? (
        <div className="empty-note" style={{ marginTop: 10, textAlign: 'left' }}>
          সাফারিতে নিচের <b>শেয়ার</b> বোতামে চাপুন, তারপর{' '}
          <b>“Add to Home Screen”</b> বেছে নিন। এরপর আর ব্রাউজারে লিংক লিখতে হবে না।
        </div>
      ) : null}
    </>
  );
}
