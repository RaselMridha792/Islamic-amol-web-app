import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { fail, readBody, requireUser, todayKey } from '../../../lib/api';
import { DAILY_QUIZ_COUNT, MORE_COUNT, MAX_PER_DAY, POINTS } from '../../../lib/points';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// আজকের ১০টা প্রশ্ন — একবার ঠিক হয়ে গেলে দিনভর একই থাকে,
// তাই পাতা রিফ্রেশ করে নতুন সহজ প্রশ্ন আনা যায় না
// রোজকার কুইজে সহজ-মাঝারিই আসে। কেউ চাইলে (hard_quiz) হাদিসের কঠিনগুলোও।
// সহজের ভাগ বেশি রাখি, নইলে শুরুতেই কঠিন লাগে।
function levelsFor(hard) {
  return hard ? ['easy', 'medium', 'hard'] : ['easy', 'medium'];
}

// দিনটা যেন একঘেয়ে না লাগে, তাই মিশিয়ে দিই:
// অর্ধেক হাতে লেখা মৌলিক প্রশ্ন (নামাজ, রোজা, নবী, আখলাক) — এগুলোই সবচেয়ে
// ধরার মতো; বাকিটা সুরার তথ্য আর মাঝারি। নইলে পুরো দিনটাই সুরার প্রশ্ন হয়ে যায়।
async function pickIds(sql, count, exclude, hard) {
  const levels = levelsFor(hard);
  const taken = exclude.slice();
  const out = [];

  async function take(where, params, n) {
    if (n <= 0) return;
    const rows = await sql.query(
      `select id from nh_questions where ${where} and not (id = any($1::bigint[]))
       order by random() limit $${params.length + 2}`,
      [taken, ...params, n]
    );
    rows.forEach((r) => {
      out.push(Number(r.id));
      taken.push(Number(r.id));
    });
  }

  await take("source = 'manual'", [], Math.ceil(count * 0.5));
  await take("level = 'easy' and source <> 'manual'", [], Math.ceil(count * 0.25));
  await take('level = any($2::text[])', [levels], count - out.length);
  // এখনো কম পড়লে যা আছে তা-ই
  await take('level = any($2::text[])', [levels], count - out.length);
  return out;
}

async function todaysIds(sql, userId, day, hard) {
  const have = await sql`select qids from nh_quiz where user_id = ${userId} and day = ${day} limit 1`;

  if (have[0]) {
    const ids = (have[0].qids || []).map(Number);
    // প্রশ্নভাণ্ডার নতুন করে বসানো হলে আগের আইডিগুলো আর থাকে না, তখন পাতা
    // ফাঁকা দেখাত। যেগুলো এখনো আছে সেগুলো রেখে বাকিটা নতুন করে ভরে দিই।
    const alive = await sql.query(
      'select id from nh_questions where id = any($1::bigint[])',
      [ids]
    );
    const keep = new Set(alive.map((r) => Number(r.id)));
    const good = ids.filter((x) => keep.has(x));
    if (good.length === ids.length) return ids;

    const need = Math.max(DAILY_QUIZ_COUNT - good.length, 0);
    const refill = need > 0 ? await pickIds(sql, need, good, hard) : [];
    const next = good.concat(refill);
    await sql`
      update nh_quiz set qids = ${JSON.stringify(next)}::jsonb
      where user_id = ${userId} and day = ${day}
    `;
    return next;
  }

  const ids = await pickIds(sql, DAILY_QUIZ_COUNT, [], hard);
  if (!ids.length) return [];
  await sql`
    insert into nh_quiz (user_id, day, qids) values (${userId}, ${day}, ${JSON.stringify(ids)}::jsonb)
    on conflict (user_id, day) do nothing
  `;
  const again = await sql`select qids from nh_quiz where user_id = ${userId} and day = ${day} limit 1`;
  return again[0] ? again[0].qids.map(Number) : ids;
}

export async function GET(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  const day = todayKey();

  try {
    const sql = db();
    const ids = (await todaysIds(sql, gate.user.id, day, gate.user.hardQuiz)).map(Number);
    if (!ids.length) return NextResponse.json({ day, questions: [], done: 0, correct: 0 });

    const [qs, answers] = await Promise.all([
      sql.query(`select id, topic, question, options, answer from nh_questions where id = any($1::bigint[])`, [ids]),
      sql`select qid, chosen, correct from nh_quiz_answer where user_id = ${gate.user.id} and day = ${day}`,
    ]);

    const answered = new Map(answers.map((a) => [Number(a.qid), a]));
    const byId = new Map(qs.map((q) => [Number(q.id), q]));

    // যেগুলোর উত্তর এখনো দেওয়া হয়নি, সেগুলোর সঠিক উত্তর ক্লায়েন্টে পাঠাই না
    const questions = ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((q) => {
        const mine = answered.get(Number(q.id));
        return {
          id: Number(q.id),
          topic: q.topic,
          question: q.question,
          options: q.options,
          chosen: mine ? mine.chosen : null,
          correct: mine ? mine.correct : null,
          answer: mine ? q.answer : null,
        };
      });

    const correct = answers.filter((a) => a.correct).length;
    return NextResponse.json({
      day,
      questions,
      done: answers.length,
      correct,
      points: correct * POINTS.quiz,
    });
  } catch (err) {
    return fail('আজকের কুইজ আনা গেল না', 503);
  }
}

export async function POST(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  const body = await readBody(req);
  if (!body) return fail('অনুরোধটা পড়া গেল না');

  const day = todayKey();

  // "আরো কুইজ" — আজকের তালিকায় আরও কিছু প্রশ্ন জুড়ে দিই।
  // যেগুলো আগেই এসেছে সেগুলো বাদ, তাই একই প্রশ্ন দুবার আসে না।
  if (body.more) {
    try {
      const sql = db();
      const have = (await todaysIds(sql, gate.user.id, day, gate.user.hardQuiz)).map(Number);
      if (have.length >= MAX_PER_DAY) {
        return fail('আজকের মতো যথেষ্ট হয়েছে, কাল আবার নতুন প্রশ্ন আসবে');
      }
      const add = await pickIds(sql, MORE_COUNT, have, gate.user.hardQuiz);
      if (!add.length) return fail('আর কোনো নতুন প্রশ্ন নেই');
      const next = have.concat(add);
      await sql`
        update nh_quiz set qids = ${JSON.stringify(next)}::jsonb
        where user_id = ${gate.user.id} and day = ${day}
      `;
      return NextResponse.json({ added: add.length, total: next.length });
    } catch (err) {
      return fail('আরও প্রশ্ন আনা গেল না', 503);
    }
  }

  const qid = Number(body.qid);
  const chosen = Number(body.chosen);
  if (!Number.isFinite(qid) || !Number.isFinite(chosen)) return fail('উত্তরটা ঠিক নেই');

  try {
    const sql = db();
    const ids = (await todaysIds(sql, gate.user.id, day, gate.user.hardQuiz)).map(Number);
    if (!ids.includes(qid)) return fail('এই প্রশ্নটা আজকের তালিকায় নেই');

    const rows = await sql`select answer, options from nh_questions where id = ${qid} limit 1`;
    if (!rows[0]) return fail('প্রশ্নটা পাওয়া গেল না', 404);
    if (chosen < 0 || chosen >= rows[0].options.length) return fail('উত্তরের ঘরটা ঠিক নেই');

    const isRight = chosen === rows[0].answer;
    // একবার উত্তর দিলে আর বদলানো যাবে না
    const put = await sql`
      insert into nh_quiz_answer (user_id, day, qid, chosen, correct)
      values (${gate.user.id}, ${day}, ${qid}, ${chosen}, ${isRight})
      on conflict (user_id, day, qid) do nothing
      returning qid
    `;
    if (!put.length) return fail('এই প্রশ্নের উত্তর আগেই দেওয়া হয়েছে');

    return NextResponse.json({
      correct: isRight,
      answer: rows[0].answer,
      points: isRight ? POINTS.quiz : 0,
    });
  } catch (err) {
    return fail('উত্তরটা জমা দেওয়া গেল না', 503);
  }
}
