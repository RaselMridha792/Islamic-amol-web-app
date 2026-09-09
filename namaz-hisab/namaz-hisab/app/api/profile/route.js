import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { fail, readBody, requireUser } from '../../../lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  try {
    const sql = db();
    const rows = await sql`select people from nh_profile where user_id = ${gate.user.id} limit 1`;
    const p = rows[0] && rows[0].people ? rows[0].people : {};
    return NextResponse.json({ name: gate.user.name, photo: p.photo || '' });
  } catch (err) {
    return fail('তথ্য আনা গেল না', 503);
  }
}

export async function POST(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  const body = await readBody(req);
  if (!body) return fail('অনুরোধটা পড়া গেল না');

  const name = String(body.name || '').trim().slice(0, 24);
  if (!name) return fail('নামটা খালি রাখা যাবে না');
  // ছবি ছোট করে পাঠানো হয় (SettingsSheet এ), তবু একটা ছাদ রাখি
  const photo = String(body.photo || '').slice(0, 300000);

  try {
    const sql = db();
    await sql`update nh_users set display_name = ${name} where id = ${gate.user.id}`;
    await sql`
      insert into nh_profile (user_id, people, updated_at)
      values (${gate.user.id}, ${JSON.stringify({ photo })}::jsonb, ${Date.now()})
      on conflict (user_id) do update set people = excluded.people, updated_at = excluded.updated_at
    `;
    return NextResponse.json({ name, photo });
  } catch (err) {
    return fail('সেভ করা গেল না', 503);
  }
}
