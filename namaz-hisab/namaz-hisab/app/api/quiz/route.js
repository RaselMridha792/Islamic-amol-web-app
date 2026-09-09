import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { fail, readBody, requireUser, todayKey } from '../../../lib/api';
import { DAILY_QUIZ_COUNT, MORE_COUNT, MAX_PER_DAY, POINTS } from '../../../lib/points';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// আজকের ১০টা প্রশ্ন — একবার ঠিক হয়ে গেলে দিনভর একই থাকে,
// তাই পাতা রিফ্রেশ করে নতুন সহজ প্রশ্ন আনা যায় না
async function todaysIds(sql, userId, day) {
  const have = await sql`select qids from nh_quiz where user_id = ${userId} and day = ${day} limit 1`;
  if (have[0]) return have[0].qids;

  const picked = await sql`
    select id from nh_questions order by random() limit ${DAILY_QUIZ_COUNT}
  `;
  const ids = picked.map((r) => Number(r.id));
  if (!ids.length) return [];
  await sql`
    insert into nh_quiz (user_id, day, qids) values (${userId}, ${day}, ${JSON.stringify(ids)}::jsonb)
    on conflict (user_id, day) do nothing
  `;
  const again = await sql`select qids from nh_quiz where user_id = ${userId} and day = ${day} limit 1`;
  return again[0] ? again[0].qids : ids;
}

export async function GET(req) {
  const gate = await requireUser(req);
  if (gate.error) return gate.error;
  const day = todayKey();

  try {
    const sql = db();
    const ids = (await todaysIds(sql, gate.user.id, day)).map(Number);
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
      const have = (await todaysIds(sql, gate.user.id, day)).map(Number);
      if (have.length >= MAX_PER_DAY) {
        return fail('আজকের মতো যথেষ্ট হয়েছে, কাল আবার নতুন প্রশ্ন আসবে');
      }
      const picked = await sql.query(
        `select id from nh_questions where not (id = any($1::bigint[]))
         order by random() limit $2`,
        [have, MORE_COUNT]
      );
      const add = picked.map((r) => Number(r.id));
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
    const ids = (await todaysIds(sql, gate.user.id, day)).map(Number);
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
