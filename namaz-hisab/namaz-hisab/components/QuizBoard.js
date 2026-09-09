'use client';

import { useEffect, useMemo, useState } from 'react';
import PageHead from './PageHead';
import { CheckIcon, CrossIcon, StarIcon } from './Icons';
import { POINTS } from '../lib/points';
import { bnNum } from '../lib/store';
import { answerQuiz, getQuiz } from '../lib/cloud';

export default function QuizBoard() {
  const [state, setState] = useState({ loading: true, questions: [], error: '' });
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getQuiz()
      .then((d) => {
        setState({ loading: false, questions: d.questions || [], error: '' });
        // যেগুলোর উত্তর দেওয়া হয়ে গেছে সেগুলো পেরিয়ে প্রথম বাকিটায় নিয়ে যাই
        const first = (d.questions || []).findIndex((q) => q.chosen === null);
        setAt(first === -1 ? Math.max((d.questions || []).length - 1, 0) : first);
      })
      .catch((err) =>
        setState({ loading: false, questions: [], error: err.message || 'কুইজ আনা গেল না' })
      );
  }, []);

  const qs = state.questions;
  const done = useMemo(() => qs.filter((q) => q.chosen !== null).length, [qs]);
  const right = useMemo(() => qs.filter((q) => q.correct).length, [qs]);
  const allDone = qs.length > 0 && done === qs.length;

  async function choose(index) {
    const q = qs[at];
    if (!q || q.chosen !== null || busy) return;
    setBusy(true);
    try {
      const res = await answerQuiz(q.id, index);
      setState((s) => ({
        ...s,
        questions: s.questions.map((x) =>
          x.id === q.id ? { ...x, chosen: index, correct: res.correct, answer: res.answer } : x
        ),
      }));
    } catch (err) {
      setState((s) => ({ ...s, error: err.message || 'উত্তরটা জমা হলো না' }));
    }
    setBusy(false);
  }

  if (state.loading) {
    return (
      <main className="shell">
        <PageHead title="আজকের কুইজ" sub="প্রতিদিন ১০টি প্রশ্ন" />
        <div className="empty-note" style={{ marginTop: 20 }}>প্রশ্ন আনা হচ্ছে…</div>
      </main>
    );
  }

  if (state.error && !qs.length) {
    return (
      <main className="shell">
        <PageHead title="আজকের কুইজ" sub="প্রতিদিন ১০টি প্রশ্ন" />
        <div className="auth-error" style={{ marginTop: 20 }}>{state.error}</div>
      </main>
    );
  }

  const q = qs[at];

  return (
    <main className="shell">
      <PageHead
        title="আজকের কুইজ"
        sub={`${bnNum(done)}/${bnNum(qs.length)} শেষ · ${bnNum(right * POINTS.quiz)} পয়েন্ট`}
      />

      <div className="quiz-dots">
        {qs.map((x, i) => (
          <button
            key={x.id}
            type="button"
            aria-label={`প্রশ্ন ${i + 1}`}
            className={
              'qdot' +
              (i === at ? ' at' : '') +
              (x.chosen === null ? '' : x.correct ? ' good' : ' bad')
            }
            onClick={() => setAt(i)}
          />
        ))}
      </div>

      {allDone ? (
        <div className="quiz-done">
          <StarIcon size={26} />
          <b>আজকের কুইজ শেষ</b>
          <span>
            {bnNum(right)}/{bnNum(qs.length)} সঠিক · {bnNum(right * POINTS.quiz)} পয়েন্ট জমা হলো
          </span>
          <small>আগামীকাল নতুন ১০টি প্রশ্ন আসবে।</small>
        </div>
      ) : null}

      {q ? (
        <section className="quiz-card">
          <div className="quiz-topic">{q.topic}</div>
          <p className="quiz-q">{q.question}</p>

          <div className="quiz-opts">
            {q.options.map((opt, i) => {
              const answered = q.chosen !== null;
              const isChosen = q.chosen === i;
              const isRight = answered && q.answer === i;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={answered || busy}
                  className={
                    'quiz-opt' +
                    (isRight ? ' right' : '') +
                    (isChosen && !isRight ? ' wrong' : '')
                  }
                  onClick={() => choose(i)}
                >
                  <span className="qo-mark">
                    {isRight ? <CheckIcon size={14} /> : null}
                    {isChosen && !isRight ? <CrossIcon size={14} /> : null}
                  </span>
                  <span className="qo-text">{opt}</span>
                </button>
              );
            })}
          </div>

          {q.chosen !== null ? (
            <div className={'quiz-verdict ' + (q.correct ? 'good' : 'bad')}>
              {q.correct ? `সঠিক · +${bnNum(POINTS.quiz)} পয়েন্ট` : 'উত্তরটা ঠিক হয়নি'}
            </div>
          ) : null}

          <div className="quiz-nav">
            <button
              type="button"
              className="btn"
              disabled={at === 0}
              onClick={() => setAt((i) => Math.max(0, i - 1))}
            >
              আগেরটা
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={at >= qs.length - 1}
              onClick={() => setAt((i) => Math.min(qs.length - 1, i + 1))}
            >
              পরেরটা
            </button>
          </div>
        </section>
      ) : null}

      {state.error ? <div className="auth-error">{state.error}</div> : null}
    </main>
  );
}
