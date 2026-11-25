import { useState } from 'react';
import { BrandMark, NoorAvatar } from '../components/NoorAvatar';
import { PACK_LIST, getPack } from '../packs';

const NAMES = ['نجمة', 'قمر', 'غيمة', 'زيتونة', 'برق', 'نسمة', 'شمس', 'موجة', 'سنبلة', 'لؤلؤة'];

export interface Start { pack: string; pseudonym: string; grade: number; classCode: string | null; quick: boolean }

/** Reads ?class=CODE (joined a live class), ?pack=id and ?quick=1 (judges: skip the two tests). */
function fromUrl() {
  const q = new URLSearchParams(location.search);
  const code = (q.get('class') || '').toUpperCase();
  return { classCode: /^[A-Z2-9]{4}$/.test(code) ? code : null, pack: q.get('pack'), quick: q.get('quick') === '1' };
}

export function Welcome({ onStart }: { onStart: (s: Start) => void }) {
  const url = fromUrl();
  const [name, setName] = useState(() => NAMES[Math.floor(Math.random() * NAMES.length)]);
  const [grade, setGrade] = useState(4);
  const [packId, setPackId] = useState(getPack(url.pack).id);
  const pack = getPack(packId);
  return (
    <main className="stage-bg min-h-full grid place-items-center p-6">
      <div className="glass w-full max-w-[600px] p-8 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <span className="font-display text-2xl font-bold block leading-none">سلسلة</span>
            <span className="text-ink-2 text-xs">Make Thinking Visible</span>
          </div>
          <a href="#/teacher" className="ms-auto text-sm text-ink-2 underline underline-offset-4">شاشة المعلّم</a>
        </div>
        {url.classCode && <div className="chip cool self-start">انضميت لصف {url.classCode}</div>}
        {!url.pack && (
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="درس اليوم">
            {PACK_LIST.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={p.id === packId} onClick={() => setPackId(p.id)}
                className={`text-start rounded-2xl p-4 border cursor-pointer ${p.id === packId ? 'border-water bg-water/10' : 'border-[var(--line)] bg-white/5'}`}>
                <span className="block font-display font-semibold">{p.title}</span>
                <span className="block text-ink-2 text-sm leading-6 mt-1">{p.question}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-4">
          <NoorAvatar size={72} />
          <p className="text-ink-2 leading-7 m-0">
            نور روبوت صغيرة ما بتعرف الجواب. إنت رح تحكيلها فكرتك، وهي رح ترسمها، وبعدين بتجرّب بنفسك لتعرف إذا فكرتك بتصمد.
          </p>
        </div>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) onStart({ pack: pack.id, pseudonym: name.trim(), grade, classCode: url.classCode, quick: url.quick }); }}
        >
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">اسمك المستعار (مش اسمك الحقيقي)</span>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} className="h-12 rounded-xl border border-[var(--line)] bg-black/25 px-4 text-lg" />
          </label>
          {!url.quick && (
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold">الصف</span>
              <select value={grade} onChange={(e) => setGrade(Number(e.target.value))} className="h-12 rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] px-4 text-lg">
                {[3, 4, 5, 6].map((g) => <option key={g} value={g}>الصف {g.toLocaleString('ar-EG')}</option>)}
              </select>
            </label>
          )}
          <button type="submit" className="btn-primary mt-2">يلا نبلّش</button>
        </form>
      </div>
    </main>
  );
}
