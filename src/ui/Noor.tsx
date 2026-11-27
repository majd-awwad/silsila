/**
 * Noor: a curious learning partner, not an all-knowing chatbot. One drawing, seven expressive states.
 * Static under reduced motion (the global rule stops animations).
 */
import { useI18n } from '../i18n';

export type NoorMood = 'curious' | 'listening' | 'thinking' | 'surprised' | 'encouraging' | 'discovering' | 'celebrating';

const LABEL: Record<NoorMood, { ar: string; en: string }> = {
  curious: { ar: 'نور فضولية', en: 'Noor is curious' },
  listening: { ar: 'نور عم تسمع', en: 'Noor is listening' },
  thinking: { ar: 'نور عم تفكّر', en: 'Noor is thinking' },
  surprised: { ar: 'نور متفاجئة', en: 'Noor is surprised' },
  encouraging: { ar: 'نور بتشجّع', en: 'Noor is encouraging you' },
  discovering: { ar: 'نور عم تكتشف', en: 'Noor is discovering' },
  celebrating: { ar: 'نور مبسوطة', en: 'Noor is celebrating' },
};

function Eyes({ mood }: { mood: NoorMood }) {
  const c = '#7DF0DC';
  if (mood === 'celebrating' || mood === 'encouraging') {
    return <g fill="none" stroke={c} strokeWidth="4.5" strokeLinecap="round"><path d="M38 66q8-11 16 0" /><path d="M66 66q8-11 16 0" /></g>;
  }
  if (mood === 'surprised') return <g fill={c}><circle cx="46" cy="63" r="8.5" /><circle cx="74" cy="63" r="8.5" /></g>;
  if (mood === 'thinking') return <g fill={c} className="noor-look"><circle cx="49" cy="59" r="5.5" /><circle cx="77" cy="59" r="5.5" /></g>;
  if (mood === 'listening') return <g fill={c}><rect x="40" y="58" width="12" height="12" rx="6" /><rect x="68" y="58" width="12" height="12" rx="6" /></g>;
  if (mood === 'discovering') return <g fill={c}><circle cx="46" cy="63" r="7" /><circle cx="74" cy="63" r="7" /><circle cx="48.5" cy="60.5" r="2.2" fill="#fff" /><circle cx="76.5" cy="60.5" r="2.2" fill="#fff" /></g>;
  return <g fill={c} className="noor-blink"><circle cx="46" cy="64" r="6" /><circle cx="74" cy="64" r="6" /></g>;
}

export function Noor({ mood = 'curious', size = 96, float = false }: { mood?: NoorMood; size?: number; float?: boolean }) {
  const { t } = useI18n();
  const mouth = mood === 'surprised' ? <circle cx="60" cy="77" r="3.6" fill="#7DF0DC" />
    : mood === 'celebrating' ? <path d="M50 74q10 11 20 0z" fill="#7DF0DC" />
      : mood === 'thinking' ? <path d="M54 77h12" stroke="#7DF0DC" strokeWidth="3" strokeLinecap="round" />
        : <path d="M52 74q8 6 16 0" fill="none" stroke="#7DF0DC" strokeWidth="3" strokeLinecap="round" />;
  return (
    <svg className={`noor noor-${mood}${float ? ' noor-float' : ''}`} width={size} height={size * 1.08} viewBox="0 0 120 130" role="img" aria-label={t(LABEL[mood])}>
      {/* antenna: a link of the chain */}
      <path d="M60 36V25" stroke="#0D5C63" strokeWidth="4" />
      <ellipse className="noor-antenna" cx="60" cy="16" rx="11" ry="8" fill="none" stroke={mood === 'discovering' || mood === 'celebrating' ? '#F0A93B' : '#43C59E'} strokeWidth="4.5" />
      <rect x="6" y="54" width="12" height="24" rx="6" fill="#0D5C63" />
      <rect x="102" y="54" width="12" height="24" rx="6" fill="#0D5C63" />
      <rect x="14" y="35" width="92" height="64" rx="28" fill="#FFFDF8" stroke="#0D5C63" strokeWidth="3.5" />
      <rect x="26" y="46" width="68" height="42" rx="18" fill="#0B2A31" />
      <Eyes mood={mood} />
      {mouth}
      <path d="M36 102h48a8 8 0 0 1 8 8v8a8 8 0 0 1-8 8H36a8 8 0 0 1-8-8v-8a8 8 0 0 1 8-8z" fill="#F0A93B" />
      <g stroke="#0B2A31" strokeWidth="3" fill="none" strokeLinecap="round"><ellipse cx="54" cy="114" rx="8" ry="5.5" /><ellipse cx="67" cy="114" rx="8" ry="5.5" /></g>
      {mood === 'celebrating' && <g stroke="#F0A93B" strokeWidth="3.5" strokeLinecap="round"><path d="M18 24l-8-8" /><path d="M102 24l8-8" /><path d="M22 36l-12-2" /><path d="M98 36l12-2" /></g>}
      {mood === 'thinking' && <g fill="#0D5C63"><circle cx="98" cy="30" r="3" /><circle cx="106" cy="20" r="4.5" /></g>}
      {mood === 'listening' && <g stroke="#43C59E" strokeWidth="3" fill="none" strokeLinecap="round" className="noor-wave"><path d="M6 42q-8 24 0 48" /><path d="M114 42q8 24 0 48" /></g>}
    </svg>
  );
}
