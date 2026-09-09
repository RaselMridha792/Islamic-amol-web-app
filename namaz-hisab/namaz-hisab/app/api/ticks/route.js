import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { fail, readBody, requireUser, safeDay } from '../../../lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS = ['dua', 'amol'];

export async function GET(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  const day = safeDay(new URL(req.url).searchParams.get('day'));

  try {
    const sql = db();
    const rows = await sql`
      select kind, item from nh_ticks where user_id = ${gate.user.id} and day = ${day}
    `;
    const out = { dua: [], amol: [] };
    rows.forEach((r) => {
      if (out[r.kind]) out[r.kind].push(r.item);
    });
    return NextResponse.json({ day, ticks: out });
  } catch (err) {
    return fail('আজকের হিসাব আনা গেল না', 503);
  }
}

export async function POST(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  const body = await readBody(req);
  if (!body) return fail('অনুরোধটা পড়া গেল না');

  const kind = String(body.kind || '');
  const item = String(body.item || '').slice(0, 64);
  if (!KINDS.includes(kind) || !item) return fail('কোন জিনিসে টিক, সেটা ঠিক নেই');
  const day = safeDay(body.day);

  try {
    const sql = db();
    if (body.on === false) {
      await sql`
        delete from nh_ticks
        where user_id = ${gate.user.id} and day = ${day} and kind = ${kind} and item = ${item}
      `;
    } else {
      await sql`
        insert into nh_ticks (user_id, day, kind, item)
        values (${gate.user.id}, ${day}, ${kind}, ${item})
        on conflict do nothing
      `;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail('টিক রাখা গেল না', 503);
  }
}
