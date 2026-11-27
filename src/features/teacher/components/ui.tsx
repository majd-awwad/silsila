/** Building blocks of the teacher workspace, on top of src/ui/kit. */
import { Component, useEffect, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { RoomError } from '../../../contracts';
import { useI18n } from '../../../i18n';
import { Modal, Notice, Shell } from '../../../ui/kit';
import type { NavItem } from '../../../ui/kit';
import { Icon } from '../../../ui/icons';
import type { IconName } from '../../../ui/icons';
import { ROOM_ERROR } from '../logic/labels';
import '../teacher.css';

export type TeacherSection = 'home' | 'library' | 'new' | 'learners' | 'studio' | 'room';

export function TeacherShell({ active, children, actions }: { active: TeacherSection; children: ReactNode; actions?: ReactNode }) {
  const nav: NavItem[] = [
    { to: '/teacher', label: { ar: 'اللوحة', en: 'Dashboard' }, active: active === 'home' },
    { to: '/teacher/library', label: { ar: 'مكتبة المفاهيم', en: 'Concept library' }, active: active === 'library' },
    { to: '/teacher/new', label: { ar: 'حصة جديدة', en: 'New session' }, active: active === 'new' },
    { to: '/teacher/learners', label: { ar: 'المتعلّمين', en: 'Learners' }, active: active === 'learners' },
    { to: '/teacher/studio', label: { ar: 'استوديو الدروس', en: 'Lesson studio' }, active: active === 'studio' },
  ];
  return <Shell nav={nav} actions={actions}>{children}</Shell>;
}

export function PageHead({ eyebrow, title, lead, actions }: { eyebrow?: ReactNode; title: ReactNode; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="tc-head">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="title">{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {actions && <div className="row no-print">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, hint, actions }: { children: ReactNode; hint?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="row">
      <div className="min-w-0 flex-1">
        <h2 className="subtitle">{children}</h2>
        {hint && <p className="help">{hint}</p>}
      </div>
      {actions && <div className="row no-print">{actions}</div>}
    </div>
  );
}

export interface TabItem<T extends string> { id: T; label: string; icon?: IconName; badge?: string }

/** Tabs with arrow-key movement that follows the reading direction. */
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: TabItem<T>[]; value: T; onChange: (id: T) => void; label: string }) {
  const { dir } = useI18n();
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    const to = e.key === forward ? index + 1 : e.key === backward ? index - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    const next = tabs[(to + tabs.length) % tabs.length];
    onChange(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };
  return (
    <div className="tc-tabs no-print" role="tablist" aria-label={label}>
      {tabs.map((tab, i) => (
        <button key={tab.id} id={`tab-${tab.id}`} type="button" role="tab" className="tc-tab" aria-selected={tab.id === value}
          aria-controls="tab-panel" tabIndex={tab.id === value ? 0 : -1} onClick={() => onChange(tab.id)} onKeyDown={(e) => onKey(e, i)}>
          {tab.icon && <Icon name={tab.icon} size={17} />}
          {tab.label}
          {tab.badge && <span className="chip chip-brand">{tab.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export function ConfirmModal({ open, title, children, confirmLabel, onConfirm, onClose, busy = false }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void; busy?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="muted">{children}</div>
      <div className="row justify-end">
        <button type="button" className="btn btn-secondary" onClick={onClose}>{t({ ar: 'تراجع', en: 'Cancel' })}</button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
          {busy && <span className="spinner" aria-hidden="true" />}{confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [state]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('done');
    } catch {
      setState('failed');
    }
  };
  return (
    <button type="button" className="btn btn-secondary btn-sm" onClick={copy} aria-live="polite">
      <Icon name={state === 'done' ? 'check' : 'link'} size={16} />
      {state === 'done' ? t({ ar: 'انتسخ', en: 'Copied' }) : state === 'failed' ? t({ ar: 'انسخوه يدوياً', en: 'Copy it by hand' }) : label}
    </button>
  );
}

export function Meter({ label, value, max }: { label: string; value: number; max: number }) {
  const { n } = useI18n();
  return (
    <div className="tc-meter">
      <span className="tc-meter-label">{label}</span>
      <span className="tc-meter-value"><b>{n(value)}</b><span className="muted"> / {n(max)}</span></span>
      <span className="bar-track" aria-hidden="true">{value > 0 && <span className="bar-fill is-real block" style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} />}</span>
    </div>
  );
}

export function RoomProblem({ error, children }: { error: RoomError; children?: ReactNode }) {
  const { t } = useI18n();
  return (
    <Notice tone="error">
      <div className="row">
        <span>{t(ROOM_ERROR[error])}</span>
        {children}
      </div>
    </Notice>
  );
}

/** Keeps one damaged record from taking the whole page down. */
export class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Prints only the given sheet (an activity plan, a lesson draft, one learner), not the whole page. */
export function usePrintSheet() {
  const [content, setContent] = useState<ReactNode>(null);
  useEffect(() => {
    if (!content) return;
    document.body.classList.add('tc-printing');
    const done = () => setContent(null);
    addEventListener('afterprint', done);
    const timer = setTimeout(() => window.print(), 80);
    return () => {
      clearTimeout(timer);
      removeEventListener('afterprint', done);
      document.body.classList.remove('tc-printing');
    };
  }, [content]);
  const sheet = content ? createPortal(<div className="tc-print-sheet">{content}</div>, document.body) : null;
  return { print: setContent, sheet };
}
