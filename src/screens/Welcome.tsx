import { useState } from 'react';
import { BrandMark, NoorAvatar } from '../components/NoorAvatar';
import { QUESTION } from '../lesson/condensation';

const NAMES = ['نجمة', 'قمر', 'غيمة', 'زيتونة', 'برق', 'نسمة', 'شمس', 'موجة', 'سنبلة', 'لؤلؤة'];

export function Welcome({ onStart }: { onStart: (pseudonym: string, grade: number) => void }) {
  const [name, setName] = useState(() => NAMES[Math.floor(Math.random() * NAMES.length)]);
  const [grade, setGrade] = useState(4);
  return (
    <main className="stage-bg min-h-full grid place-items-center p-6">
      <div className="glass w-full max-w-[560px] p-8 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="font-display text-2xl font-bold">سلسلة</span>
          <a href="#/teacher" className="ms-auto text-sm text-ink-2 underline underline-offset-4">شاشة المعلّم</a>
        </div>
        <div className="flex items-center gap-4">
          <NoorAvatar size={72} />
          <div>
            <p className="text-ink-2 text-sm m-0">درس اليوم</p>
            <h1 className="font-display text-2xl font-semibold leading-snug m-0">{QUESTION}</h1>
          </div>
        </div>
        <p className="text-ink-2 leading-7 m-0">
          نور روبوت صغيرة ما بتعرف الجواب. إنت رح تحكيلها فكرتك، وهي رح ترسمها، وبعدين بتجرّبوا مع بعض لتعرفوا إذا فكرتك صح.
        </p>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) onStart(name.trim(), grade); }}
        >
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">اسمك المستعار (مش اسمك الحقيقي)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              className="h-12 rounded-xl border border-[var(--line)] bg-black/25 px-4 text-lg"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">الصف</span>
            <select value={grade} onChange={(e) => setGrade(Number(e.target.value))} className="h-12 rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] px-4 text-lg">
              {[3, 4, 5, 6].map((g) => <option key={g} value={g}>الصف {g.toLocaleString('ar-EG')}</option>)}
            </select>
          </label>
          <button type="submit" className="btn-primary mt-2">يلا نبلّش</button>
        </form>
      </div>
    </main>
  );
}
