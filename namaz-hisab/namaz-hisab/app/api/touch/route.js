import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { fail, readBody, requireUser } from '../../../lib/api';
import { sendToUser } from '../../../lib/push';
import { cleanPart } from '../../../lib/touch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// স্পর্শ — সঙ্গীর স্ক্রিনে আঁকা আর তার ফোন কাঁপানো।
//
// আঁকা শুরু হলে সঙ্গীকে একটা পুশ যায়। তার অ্যাপ সামনে খোলা থাকলে সার্ভিস
// ওয়ার্কার পাতাকে জানিয়ে দেয়, পাতা এখান থেকে টুকরোগুলো টেনে আঁকার সাথে
// সাথে দেখায়। না থাকলে নোটিফিকেশন, চাপ দিলে পুরো আঁকাটা আবার ফুটে ওঠে।
// পুশ কোনো কারণে না পৌঁছালেও ১৫ মিনিটের মধ্যে অ্যাপ খুললে না-দেখা আঁকা
// বা ডাক দেখিয়ে দেওয়া হয়।

const MAX_PARTS = 3000;        // এক আঁকায় সর্বোচ্চ কয় টুকরো
const MAX_PART_BYTES = 24000;
const BUZZ_GAP_SEC = 3;        // পরপর কাঁপানোর মাঝে অন্তত এটুকু ফাঁক
const CATCH_UP_MIN = 15;       // এর চেয়ে পুরনো না-দেখা জিনিস আর দেখাই না
const KEEP_DAYS = 2;

const toInt = (v) => (Number.isInteger(Number(v)) ? Number(v) : null);

// সঙ্গী — দুদিক থেকেই জোড়া বাঁধা থাকতে হবে
async function partnerOf(sql, me, partnerId) {
  if (!partnerId) return null;
  const rows = await sql`
    select u.id, coalesce(u.display_name, u.username) as name, u.touch_draw, u.touch_buzz,
      (select count(*)::int from nh_push p where p.user_id = u.id) as devices
    from nh_users u
    where u.id = ${partnerId} and u.partner_id = ${me}
    limit 1
  `;
  if (!rows[0]) return null;
  return {
    id: Number(rows[0].id),
    name: rows[0].name,
    draw: rows[0].touch_draw !== false,
    buzz: rows[0].touch_buzz !== false,
    devices: rows[0].devices,
  };
}

export async function GET(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  const me = gate.user.id;
  const q = new URL(req.url).searchParams;

  try {
    const sql = db();

    /* ---- একটা আঁকার টুকরোগুলো, after এর পর থেকে ---- */
    if (q.get('id')) {
      const id = toInt(q.get('id'));
      const after = Math.max(0, toInt(q.get('after')) || 0);
      if (!id) return fail('ভুল অনুরোধ');
      const rows = await sql`
        select t.id, t.to_id, t.kind, t.aspect, t.done, coalesce(u.display_name, u.username) as from_name
        from nh_touch t join nh_users u on u.id = t.from_id
        where t.id = ${id} and (t.to_id = ${me} or t.from_id = ${me})
        limit 1
      `;
      const t = rows[0];
      if (!t) return fail('পাওয়া গেল না', 404);
      const [parts] = await Promise.all([
        sql`
          select seq, data from nh_touch_part
          where touch_id = ${id} and seq > ${after}
          order by seq limit 400
        `,
        // প্রথমবার খুললেই দেখা হয়েছে ধরি, যাতে পরে আবার না দেখাই
        Number(t.to_id) === me && after === 0
          ? sql`update nh_touch set seen_at = now() where id = ${id} and seen_at is null`
          : Promise.resolve(),
      ]);
      return NextResponse.json({
        id,
        kind: t.kind,
        aspect: Number(t.aspect) || 2,
        done: t.done,
        from: t.from_name,
        parts: parts.map((p) => ({ seq: p.seq, data: p.data })),
      });
    }

    /* ---- না-দেখা আঁকা বা ডাক, যা পুশে পৌঁছায়নি ---- */
    if (q.get('pending')) {
      const rows = await sql`
        select t.id, t.kind, coalesce(u.display_name, u.username) as from_name
        from nh_touch t join nh_users u on u.id = t.from_id
        where t.to_id = ${me} and t.seen_at is null
          and t.created_at > now() - make_interval(mins => ${CATCH_UP_MIN})
        order by t.id desc limit 1
      `;
      const t = rows[0];
      if (!t) return NextResponse.json({ touch: null });
      // ডাক একবার দেখালেই হলো — জমে থাকা সবগুলো একসাথে দেখা ধরি
      if (t.kind === 'buzz') {
        await sql`update nh_touch set seen_at = now() where to_id = ${me} and kind = 'buzz' and seen_at is null`;
      }
      return NextResponse.json({ touch: { id: Number(t.id), kind: t.kind, from: t.from_name } });
    }

    /* ---- যে আঁকবে বা কাঁপাবে, তার জন্য সঙ্গীর অবস্থা ---- */
    const partner = await partnerOf(sql, me, gate.user.partnerId);
    return NextResponse.json({ partner });
  } catch (err) {
    return fail('আনা গেল না', 503);
  }
}

export async function POST(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  const body = await readBody(req);
  if (!body) return fail('অনুরোধটা পড়া গেল না');
  const me = gate.user.id;
  const myName = gate.user.name;

  try {
    const sql = db();

    /* ---- আঁকা শুরু: সঙ্গীকে জানাই ---- */
    if (body.action === 'start') {
      const p = await partnerOf(sql, me, gate.user.partnerId);
      if (!p) return fail('আগে সঙ্গীর সাথে জোড়া বাঁধুন');
      if (!p.draw) return fail(`${p.name} স্ক্রিনে আঁকা বন্ধ রেখেছেন`, 403);
      const aspect = Math.min(3, Math.max(0.5, Number(body.aspect) || 2));

      await sql`delete from nh_touch where created_at < now() - make_interval(days => ${KEEP_DAYS})`;
      const rows = await sql`
        insert into nh_touch (from_id, to_id, kind, aspect)
        values (${me}, ${p.id}, 'draw', ${aspect})
        returning id
      `;
      const id = Number(rows[0].id);
      const res = await sendToUser(
        p.id,
        {
          type: 'touch',
          id,
          from: myName,
          title: `${myName} আপনার জন্য আঁকছেন`,
          body: 'দেখতে এখানে চাপ দিন',
          url: `/?touch=${id}`,
          tag: 'touch',
        },
        { TTL: 6 * 3600, urgency: 'high' }
      );
      return NextResponse.json({ id, sent: res.sent, devices: p.devices });
    }

    /* ---- আঁকার একটা টুকরো ---- */
    if (body.action === 'part') {
      const id = toInt(body.id);
      const seq = toInt(body.seq);
      if (!id || !seq || seq < 1 || seq > MAX_PARTS) return fail('ভুল টুকরো');
      const data = cleanPart(body.data);
      if (!data) return fail('আঁকাটা পড়া গেল না');
      const json = JSON.stringify(data);
      if (json.length > MAX_PART_BYTES) return fail('টুকরোটা বড় হয়ে গেছে');
      // নিজের, চলতি আঁকাতেই শুধু যোগ হয়; একই টুকরো দুবার এলে (আবার চেষ্টা) একবারই থাকে
      const rows = await sql`
        insert into nh_touch_part (touch_id, seq, data)
        select t.id, ${seq}, ${json}::jsonb from nh_touch t
        where t.id = ${id} and t.from_id = ${me} and t.kind = 'draw' and not t.done
        on conflict do nothing
        returning seq
      `;
      return NextResponse.json({ saved: rows.length });
    }

    /* ---- আঁকা শেষ ---- */
    if (body.action === 'end') {
      const id = toInt(body.id);
      if (!id) return fail('ভুল অনুরোধ');
      await sql`update nh_touch set done = true where id = ${id} and from_id = ${me}`;
      return NextResponse.json({ done: true });
    }

    /* ---- ফোন কাঁপানো ---- */
    if (body.action === 'buzz') {
      const p = await partnerOf(sql, me, gate.user.partnerId);
      if (!p) return fail('আগে সঙ্গীর সাথে জোড়া বাঁধুন');
      if (!p.buzz) return fail(`${p.name} ফোন কাঁপানো বন্ধ রেখেছেন`, 403);
      const recent = await sql`
        select 1 from nh_touch
        where from_id = ${me} and kind = 'buzz'
          and created_at > now() - make_interval(secs => ${BUZZ_GAP_SEC})
        limit 1
      `;
      if (recent.length) return fail('একটু থামুন — এইমাত্র কাঁপিয়েছেন', 429);

      const rows = await sql`
        insert into nh_touch (from_id, to_id, kind, done)
        values (${me}, ${p.id}, 'buzz', true)
        returning id
      `;
      const id = Number(rows[0].id);
      // দেরিতে পৌঁছানো ডাকের মানে নেই, তাই দুই মিনিটের বেশি অপেক্ষা করে না
      const res = await sendToUser(
        p.id,
        {
          type: 'buzz',
          id,
          from: myName,
          title: `${myName} আপনাকে ডাকছেন`,
          body: 'আপনার কথা মনে পড়েছে',
          url: `/?buzz=${id}`,
          tag: 'buzz',
        },
        { TTL: 120, urgency: 'high' }
      );
      return NextResponse.json({ id, sent: res.sent, devices: p.devices });
    }

    return fail('অজানা অনুরোধ');
  } catch (err) {
    return fail('কাজটা শেষ করা গেল না', 503);
  }
}
