import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { fail, readBody, requireUser } from '../../../lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_HOURS = 24;

function makeCode() {
  let out = '';
  for (let i = 0; i < 6; i += 1) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

async function partnerOf(sql, userId) {
  const rows = await sql`
    select p.id, p.username, p.display_name
    from nh_users u join nh_users p on p.id = u.partner_id
    where u.id = ${userId} limit 1
  `;
  if (!rows[0]) return null;
  return { id: rows[0].id, username: rows[0].username, name: rows[0].display_name || rows[0].username };
}

export async function GET(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  try {
    const sql = db();
    const [partner, codes] = await Promise.all([
      partnerOf(sql, gate.user.id),
      sql`select code from nh_pair_codes where user_id = ${gate.user.id} and expires_at > now() limit 1`,
    ]);
    return NextResponse.json({ partner, code: codes[0] ? codes[0].code : null });
  } catch (err) {
    return fail('জোড়ার তথ্য আনা গেল না', 503);
  }
}

export async function POST(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  const body = await readBody(req);
  if (!body) return fail('অনুরোধটা পড়া গেল না');

  const sql = db();
  const me = gate.user.id;

  try {
    /* ---- নিজের কোড বানাই, সঙ্গী এটা লিখে জোড়া বাঁধবে ---- */
    if (body.action === 'code') {
      const already = await partnerOf(sql, me);
      if (already) return fail('আপনি আগেই জোড়া বেঁধেছেন');
      await sql`delete from nh_pair_codes where user_id = ${me}`;
      const code = makeCode();
      await sql`
        insert into nh_pair_codes (code, user_id, expires_at)
        values (${code}, ${me}, now() + make_interval(hours => ${CODE_HOURS}))
      `;
      return NextResponse.json({ code });
    }

    /* ---- সঙ্গীর কোড দিয়ে জোড়া বাঁধা ---- */
    if (body.action === 'join') {
      const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length !== 6) return fail('কোডটা ৬ অক্ষরের হতে হবে');

      const rows = await sql`
        select user_id from nh_pair_codes where code = ${code} and expires_at > now() limit 1
      `;
      if (!rows[0]) return fail('কোডটা মিলছে না, বা মেয়াদ পেরিয়ে গেছে');
      const other = Number(rows[0].user_id);
      if (other === me) return fail('নিজের কোড নিজে দেওয়া যাবে না');

      // দুজনের কেউই যেন আগে থেকে জোড়া বাঁধা না থাকে
      const busy = await sql`
        select id from nh_users where id in (${me}, ${other}) and partner_id is not null
      `;
      if (busy.length) return fail('আপনাদের একজন আগেই অন্য কারও সাথে জোড়া বেঁধে আছেন');

      await sql`update nh_users set partner_id = ${other} where id = ${me}`;
      await sql`update nh_users set partner_id = ${me} where id = ${other}`;
      await sql`delete from nh_pair_codes where user_id in (${me}, ${other})`;

      return NextResponse.json({ partner: await partnerOf(sql, me) });
    }

    /* ---- জোড়া খুলে দেওয়া, দুদিক থেকেই ---- */
    if (body.action === 'unpair') {
      const rows = await sql`select partner_id from nh_users where id = ${me} limit 1`;
      const other = rows[0] && rows[0].partner_id ? Number(rows[0].partner_id) : null;
      await sql`update nh_users set partner_id = null where id = ${me}`;
      if (other) await sql`update nh_users set partner_id = null where id = ${other}`;
      return NextResponse.json({ partner: null });
    }

    return fail('অজানা অনুরোধ');
  } catch (err) {
    return fail('কাজটা শেষ করা গেল না', 503);
  }
}
