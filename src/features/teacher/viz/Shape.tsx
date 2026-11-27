/** One shape per group family, so a group is recognisable without colour. */
import type { GroupShape } from '../logic/labels';

export function Shape({ shape, size = 16 }: { shape: GroupShape; size?: number }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  return (
    <svg className="shape" data-shape={shape} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      {shape === 'real' && <><circle cx="10" cy="10" r="8" fill="currentColor" /><path d="M6 10.4l2.8 2.8L14.2 7.6" fill="none" stroke="var(--shape-cut, #fff)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></>}
      {shape === 'partial' && <><circle cx="10" cy="10" r="7.5" {...common} /><path d="M10 2.5a7.5 7.5 0 0 1 0 15z" fill="currentColor" /></>}
      {shape === 'idea' && <path d="M10 2.8l8 14.2H2z" {...common} />}
      {shape === 'contra' && <><path d="M10 1.8l8.2 8.2-8.2 8.2L1.8 10z" {...common} /><path d="M7.4 7.4l5.2 5.2M12.6 7.4l-5.2 5.2" {...common} /></>}
      {shape === 'unclear' && <circle cx="10" cy="10" r="7.5" {...common} strokeDasharray="2.6 3.4" />}
      {shape === 'waiting' && <><circle cx="10" cy="10" r="7.5" {...common} /><path d="M10 6v4l2.6 1.8" {...common} /></>}
    </svg>
  );
}
