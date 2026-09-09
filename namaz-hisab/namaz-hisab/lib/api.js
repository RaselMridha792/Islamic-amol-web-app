import { NextResponse } from 'next/server';
import { COOKIE, userFromToken } from './auth';
import { ensureSchema, hasDb } from './db';

// সব API রুটের সাধারণ কাজগুলো এক জায়গায়

export function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// লগইন না থাকলে আর এগোনো যাবে না — সব নতুন ফিচারই অ্যাকাউন্টের সাথে বাঁধা
export async function requireUser(req) {
  if (!hasDb()) return { error: fail('সার্ভারে ডেটাবেস যুক্ত করা হয়নি', 503) };
  try {
    await ensureSchema();
    const user = await userFromToken(req.cookies.get(COOKIE)?.value);
    if (!user) return { error: fail('লগইন করা নেই', 401) };
    return { user };
  } catch (err) {
    return { error: fail('ডেটাবেসে পৌঁছানো গেল না', 503) };
  }
}

// দিন গোনা হয় ঢাকার সময় ধরে, নইলে রাত ১২টার আগেই দিন বদলে যেত
const DHAKA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dhaka',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayKey() {
  return DHAKA.format(new Date());
}

export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function safeDay(value) {
  return DAY_RE.test(String(value || '')) ? value : todayKey();
}

export async function readBody(req) {
  try {
    return await req.json();
  } catch (err) {
    return null;
  }
}
