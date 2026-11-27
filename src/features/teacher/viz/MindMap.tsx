/**
 * The Collective Mind Map: the class's ideas as links of a chain around the question. A node's size is the number
 * of learners who share it; its shape, word and colour say what kind of idea it is. It never carries names.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { HypothesisGroup } from '../../../contracts';
import { useI18n } from '../../../i18n';
import type { ConceptPack } from '../../../packs/types';
import { SHAPE_WORD, groupShape, groupTitle, orderKeys } from '../logic/labels';
import { RING_LIMIT, beadSize, ringPositions } from './layout';
import { Shape } from './Shape';
import './viz.css';

export interface MindMapProps {
  pack: ConceptPack;
  groups: HypothesisGroup[];
  variant?: 'teacher' | 'screen';
  /** the group whose detail is open */
  selected?: string | null;
  /** when given, nodes are buttons */
  onSelect?: (key: string) => void;
}

export function MindMap({ pack, groups, variant = 'teacher', selected = null, onSelect }: MindMapProps) {
  const { t, n } = useI18n();
  const ordered = [...groups].sort(orderKeys);
  const max = Math.max(1, ...ordered.map((g) => g.count));
  const total = ordered.reduce((s, g) => s + g.count, 0);
  const ring = ordered.length <= RING_LIMIT;
  const places = ringPositions(ordered.length);
  const [small, large] = variant === 'screen' ? [64, 128] : [44, 92];

  return (
    <div className="mm" data-variant={variant} data-layout={ring ? 'ring' : 'list'}>
      <div className="mm-canvas">
        {ring && (
          <svg className="mm-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {ordered.map((g, i) => {
              const p = places[i];
              // a gentle bend, so links read as a chain and not as spokes
              const bend = 0.09;
              const cx = (50 + p.x) / 2 - (p.y - 50) * bend;
              const cy = (50 + p.y) / 2 + (p.x - 50) * bend;
              const d = `M50 50Q${cx.toFixed(2)} ${cy.toFixed(2)} ${p.x} ${p.y}`;
              const width = 8 + Math.round((10 * g.count) / max);
              // dashes spaced wider than the stroke, hollowed by the core: each dash reads as one link
              const dash = { strokeDasharray: `12 ${width + 7}`, '--period': 19 + width } as CSSProperties;
              return (
                <g key={g.key} data-shape={groupShape(g.key)} className="mm-link">
                  <path className="mm-chain" d={d} style={{ ...dash, strokeWidth: width }} />
                  <path className="mm-chain-core" d={d} style={{ ...dash, strokeWidth: Math.max(2, width - 7) }} />
                </g>
              );
            })}
          </svg>
        )}
        <div className="mm-hub">
          <span className="mm-question">{t(pack.question)}</span>
          <span className="mm-total">{t({ ar: 'شروحات', en: 'Explanations' })}: <b>{n(total)}</b></span>
        </div>
        <ul className="mm-nodes">
          {ordered.map((g, i) => {
            const shape = groupShape(g.key);
            const style = {
              '--x': `${places[i]?.x ?? 50}%`, '--y': `${places[i]?.y ?? 50}%`, '--bead': `${beadSize(g.count, max, small, large)}px`, '--i': i,
            } as CSSProperties;
            const title = t(groupTitle(pack, g.key));
            const content: ReactNode = (
              <>
                <span className="mm-bead"><b>{n(g.count)}</b></span>
                <span className="mm-text">
                  <span className="mm-label">{title}</span>
                  <span className="mm-status"><Shape shape={shape} size={variant === 'screen' ? 20 : 14} />{t(SHAPE_WORD[shape])}</span>
                </span>
              </>
            );
            return (
              <li key={g.key} className="mm-node" data-shape={shape} style={style}>
                {onSelect ? (
                  <button type="button" className="mm-card" aria-pressed={selected === g.key} onClick={() => onSelect(g.key)}>{content}</button>
                ) : (
                  <div className="mm-card">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
