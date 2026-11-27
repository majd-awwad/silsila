/** Shared building blocks. Styling lives in src/styles.css; these add structure and accessibility. */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import QRCode from 'qrcode';
import type { Diagnosis, DiagnosisStatus, L } from '../contracts';
import { useI18n } from '../i18n';
import { href } from '../router';
import { Icon } from './icons';

/** The SILSILA mark: linked rings, one of them still being formed. */
export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="#0D5C63" />
      <g fill="none" strokeWidth="3" strokeLinecap="round">
        <ellipse cx="15" cy="24" rx="8" ry="5.5" transform="rotate(-38 15 24)" stroke="#43C59E" />
        <ellipse cx="25" cy="16" rx="8" ry="5.5" transform="rotate(-38 25 16)" stroke="#F0A93B" />
      </g>
    </svg>
  );
}

export function Brand({ to = '/' }: { to?: string }) {
  const { lang } = useI18n();
  return (
    <a href={href(to)} className="flex items-center gap-2.5 no-underline text-ink">
      <BrandMark />
      <span className="flex flex-col leading-none">
        <strong className="font-display text-[19px]">{lang === 'ar' ? 'سِلسِلة' : 'SILSILA'}</strong>
        <small className="text-ink-2 text-[11px] hide-sm">{lang === 'ar' ? 'SILSILA' : 'سِلسِلة'}</small>
      </span>
    </a>
  );
}

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} lang={lang === 'ar' ? 'en' : 'ar'}>
      <Icon name="globe" size={17} />{lang === 'ar' ? 'English' : 'العربية'}
    </button>
  );
}

export interface NavItem { to: string; label: L; active?: boolean }

/** Page frame: skip link, sticky header, main landmark. */
export function Shell({ children, nav = [], actions, narrow = false, home = '/' }: {
  children: ReactNode; nav?: NavItem[]; actions?: ReactNode; narrow?: boolean; home?: string;
}) {
  const { t } = useI18n();
  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>{t({ ar: 'انتقل للمحتوى', en: 'Skip to content' })}</a>
      <header className="topbar no-print">
        <div className="topbar-in">
          <Brand to={home} />
          {nav.length > 0 && (
            <nav aria-label={t({ ar: 'التنقّل', en: 'Navigation' })} className="flex gap-1 overflow-x-auto min-w-0 ms-2">
              {nav.map((i) => (
                <a key={i.to} href={href(i.to)} aria-current={i.active ? 'page' : undefined}
                  className={`btn btn-sm whitespace-nowrap ${i.active ? 'btn-secondary' : 'btn-ghost'}`}>{t(i.label)}</a>
              ))}
            </nav>
          )}
          <div className="ms-auto flex items-center gap-2">{actions}<LangToggle /></div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className={`wrap ${narrow ? 'wrap-narrow' : ''} outline-none`}>{children}</main>
    </>
  );
}

export function Notice({ tone = 'info', children, icon }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode; icon?: ReactNode }) {
  return (
    <div className={`notice ${tone === 'warn' ? 'notice-warn' : tone === 'error' ? 'notice-error' : ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      {icon ?? <Icon name={tone === 'error' ? 'cross' : tone === 'warn' ? 'question' : 'check'} />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Loading({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="grid place-items-center gap-3 py-12 text-ink-2" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label ?? t({ ar: 'لحظة…', en: 'One moment…' })}</span>
    </div>
  );
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="empty"><div>{children}</div>{action}</div>;
}

/** Which engine understood the words: the model or the offline rules. Never hide this. */
export function SourceBadge({ source, reason }: { source: 'ai' | 'fallback'; reason?: Diagnosis['fallbackReason'] }) {
  const { t } = useI18n();
  const why: Record<NonNullable<Diagnosis['fallbackReason']>, L> = {
    no_key: { ar: 'ما في مفتاح', en: 'no API key' }, ai_error: { ar: 'تعذّر الموديل', en: 'model failed' },
    network: { ar: 'ما في اتصال', en: 'no connection' }, offline_mode: { ar: 'وضع بدون إنترنت', en: 'offline mode' },
  };
  return source === 'ai'
    ? <span className="chip chip-brand"><Icon name="spark" size={14} />{t({ ar: 'تحليل بالذكاء الاصطناعي', en: 'AI analysis' })}</span>
    : <span className="chip chip-idea"><Icon name="offline" size={14} />{t({ ar: 'قواعد احتياطية', en: 'Offline rules' })}{reason ? ` · ${t(why[reason])}` : ''}</span>;
}

export const STATUS_LABEL: Record<DiagnosisStatus | 'waiting', L> = {
  correct: { ar: 'فهم كامل', en: 'Complete explanation' },
  partial: { ar: 'فهم جزئي', en: 'Partial understanding' },
  misconception: { ar: 'فكرة بدها اختبار', en: 'Idea to investigate' },
  multiple: { ar: 'أكتر من فكرة', en: 'Several ideas' },
  insufficient: { ar: 'لسا مش واضح', en: 'Not enough evidence' },
  contradictory: { ar: 'فيه تناقض', en: 'Contradictory' },
  offtopic: { ar: 'خارج الموضوع', en: 'Off topic' },
  unsupported: { ar: 'فكرة خارج المحاكاة', en: 'Cannot be simulated' },
  waiting: { ar: 'لسا ما جاوب', en: 'No answer yet' },
};

export function StatusChip({ status }: { status: DiagnosisStatus | 'waiting' }) {
  const { t } = useI18n();
  const cls = status === 'correct' ? 'chip-real' : status === 'partial' ? 'chip-brand' : status === 'misconception' || status === 'multiple' ? 'chip-idea' : status === 'contradictory' ? 'chip-probe' : '';
  return <span className={`chip ${cls}`}>{t(STATUS_LABEL[status])}</span>;
}

export function Bar({ label, value, max, tone = 'idea', note }: { label: ReactNode; value: number; max: number; tone?: 'idea' | 'real' | 'neutral'; note?: ReactNode }) {
  const { n } = useI18n();
  return (
    <div className="bar-row">
      <div className="font-semibold min-w-0">{label}{note && <div className="muted text-[12.5px] font-normal">{note}</div>}</div>
      <div className="bar-track" aria-hidden="true">{value > 0 && <div className={`bar-fill ${tone === 'real' ? 'is-real' : tone === 'neutral' ? 'is-neutral' : ''}`} style={{ width: `${(value / Math.max(1, max)) * 100}%` }} />}</div>
      <strong className="tabular-nums">{n(value)}</strong>
    </div>
  );
}

export function QR({ value, size = 220, label }: { value: string; size?: number; label: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: 'svg', margin: 1, color: { dark: '#0B2A31', light: '#FFFFFF' } }).then((s) => alive && setSvg(s)).catch(() => alive && setSvg(''));
    return () => { alive = false; };
  }, [value]);
  return <div role="img" aria-label={label} className="bg-white rounded-2xl p-2 shrink-0 [&>svg]:w-full [&>svg]:h-full" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-label={title}
      className="m-auto w-[min(720px,calc(100%-24px))] max-h-[88dvh] overflow-auto rounded-3xl border border-line bg-paper text-ink p-0 backdrop:bg-black/50">
      {open && (
        <div className="p-5 stack">
          <div className="flex items-start gap-3">
            <h2 className="subtitle flex-1">{title}</h2>
            <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t({ ar: 'سكّر', en: 'Close' })}><Icon name="cross" /></button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  );
}

export function SampleBanner({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="sample-banner" role="note">
      {t({ ar: 'بيانات تجريبية: متعلّمين وهميين على هالجهاز، مش مشاركين حقيقيين.', en: 'Sample data: example learners on this device, not real participants.' })}
      {children}
    </div>
  );
}

/** Download text the teacher asked for (reports, exports). */
export function downloadFile(name: string, content: string, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
