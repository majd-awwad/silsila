import summary from '../../../evals/reports/latest-offline-summary.json';
import { useI18n } from '../../i18n';
import { PACKS } from '../../packs';

export function EvidencePanel() {
  const { t, n } = useI18n();
  const rate = (value: { pct: number | null; n: number; of: number }) => value.pct === null ? '—' : n(value.pct, 1) + '% (' + n(value.n) + '/' + n(value.of) + ')';
  return <section className="card stack" aria-labelledby="diagnosis-evidence">
    <h2 id="diagnosis-evidence" className="subtitle">{t({ ar: 'قياس التشخيص بدون اتصال', en: 'Offline diagnosis results' })}</h2>
    <p>{t({ ar: 'جمل التقييم المنفصلة عن تطوير القواعد، لكل حزمة.', en: 'Results on sentences held out from rule development, by concept pack.' })}</p>
    <dl className="stack !gap-2">
      {Object.entries(summary.packs).map(([id, row]) => <div key={id} className="row !justify-between">
        <dt>{t(PACKS[id].title)}</dt><dd dir="auto">{rate(row.endToEnd)}</dd>
      </div>)}
      <div className="row !justify-between"><dt className="font-bold">{t({ ar: 'كل جمل الاختبار المنفصلة', en: 'All held-out cases' })}</dt><dd>{rate(summary.holdout.endToEnd)}</dd></div>
      <div className="row !justify-between"><dt>{t({ ar: 'كشف الجواب مبكراً', en: 'Early answer disclosure' })}</dt><dd>{rate(summary.holdout.answerLeakage)}</dd></div>
    </dl>
    <p className="help">{t({ ar: 'الجمل كتبها الفريق ومساعد ذكاء اصطناعي. التصنيفات بحاجة لمراجعة مستقلة. النتائج تقيس التشخيص، وأثر التعلّم لسه بحاجة لدراسة مع طلاب.', en: 'The team and an AI assistant wrote the cases. Their labels need independent review. This measures diagnosis agreement. Learning outcomes require a separate study with students.' })}</p>
  </section>;
}
