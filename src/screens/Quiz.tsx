import { useState } from 'react';
import type { QuizResult } from '../contracts';
import type { QuizQuestion } from '../lesson/condensation';

const fmt = (n: number) => n.toLocaleString('ar-EG');

/** Pre/post test: one question at a time, no right/wrong feedback (it would teach the answer). */
export function Quiz({ title, intro, questions, onDone }: {
  title: string; intro: string; questions: QuizQuestion[]; onDone: (r: QuizResult) => void;
}) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const q = questions[i];
  const choose = (k: number) => {
    const next = [...answers, k];
    if (next.length === questions.length) {
      const score = next.reduce((s, a, j) => s + (a === questions[j].correct ? 1 : 0), 0);
      onDone({ answers: next, score, total: questions.length });
    } else {
      setAnswers(next);
      setI(i + 1);
    }
  };
  return (
    <main className="stage-bg min-h-full grid place-items-center p-6">
      <div className="glass w-full max-w-[640px] p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-xl font-semibold m-0">{title}</h1>
          <span className="text-ink-2 text-sm">سؤال {fmt(i + 1)} من {fmt(questions.length)}</span>
        </div>
        <div className="h-1.5 rounded bg-white/10 overflow-hidden">
          <div className="h-full bg-water transition-all" style={{ width: `${(i / questions.length) * 100}%` }} />
        </div>
        {i === 0 && <p className="text-ink-2 m-0 leading-7">{intro}</p>}
        <p className="font-display text-2xl leading-relaxed m-0">{q.q}</p>
        <div className="flex flex-col gap-3" role="group" aria-label="الخيارات">
          {q.options.map((o, k) => (
            <button
              key={k}
              type="button"
              onClick={() => choose(k)}
              className="text-start min-h-14 px-5 py-3 rounded-2xl border border-[var(--line)] bg-white/5 hover:bg-white/10 text-lg cursor-pointer"
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
