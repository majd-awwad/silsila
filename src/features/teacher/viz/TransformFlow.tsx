/**
 * Before → after: ribbons from each first-explanation group to each revised group, and one travelling dot per
 * learner. Thickness and dots are exactly the recorded counts; the same facts are listed in words underneath.
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useI18n } from '../../../i18n';
import type { ConceptPack } from '../../../packs/types';
import { CHANGE_LABEL, classifyChange } from '../logic/insight';
import { groupShape, groupTitle } from '../logic/labels';
import { flowLayout, laneAt, ribbonPath } from './layout';
import type { FlowLink, FlowNode, Move } from './layout';
import { Shape } from './Shape';
import { Icon } from '../../../ui/icons';
import './viz.css';

const MAX_DOTS = 60;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.round(el.clientWidth));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return { ref, width };
}

/** A point on the ribbon's centre line, close to the arriving side, where ribbons are furthest apart. */
function labelPoint(l: FlowLink, sx: number, tx: number, at = 0.82) {
  const u = 1 - at;
  const mid = (sx + tx) / 2;
  const s = (l.s0 + l.s1) / 2;
  const t = (l.t0 + l.t1) / 2;
  return {
    x: u ** 3 * sx + 3 * u * u * at * mid + 3 * u * at * at * mid + at ** 3 * tx,
    y: u ** 3 * s + 3 * u * u * at * s + 3 * u * at * at * t + at ** 3 * t,
  };
}

export interface TransformFlowProps {
  pack: ConceptPack;
  moves: Move[];
  variant?: 'teacher' | 'screen';
  /** canvas height before labels force it taller */
  height?: number;
}

export function TransformFlow({ pack, moves, variant = 'teacher', height }: TransformFlowProps) {
  const { t, n, dir } = useI18n();
  const { ref, width } = useWidth();
  const [run, setRun] = useState(0);
  const screen = variant === 'screen';
  const layout = flowLayout(moves, { height: height ?? (screen ? 520 : 320), gap: screen ? 20 : 12, minNode: screen ? 76 : 52 });
  if (!layout.total) return null;
  const rtl = dir === 'rtl';
  // the first explanations sit at the reading start: left in English, right in Arabic
  const sx = rtl ? width : 0;
  const tx = rtl ? 0 : width;
  const moved = layout.links.map((l) => `${l.from}>${l.to}:${l.count}`).join('|');

  const column = (nodes: FlowNode[], side: 'from' | 'to') => (
    <div className={`fl-col fl-${side}`} style={{ height: layout.height }}>
      {nodes.map((node) => {
        const shape = groupShape(node.key);
        return (
          <div key={node.key} className="fl-node" data-shape={shape} style={{ top: node.y0, height: node.y1 - node.y0 }}>
            <Shape shape={shape} size={screen ? 26 : 16} />
            <span className="fl-name">{t(groupTitle(pack, node.key))}</span>
            <b className="fl-count">{n(node.count)}</b>
          </div>
        );
      })}
    </div>
  );

  let dots = 0;
  return (
    <figure className="fl" data-variant={variant}>
      <div className="fl-grid">
        <div className="fl-head">{t({ ar: 'أول شرح', en: 'First explanation' })}</div>
        <div className="fl-head fl-head-mid">
          <button type="button" className="btn btn-secondary btn-sm no-print" onClick={() => setRun((x) => x + 1)}>
            <Icon name="replay" size={16} />{t({ ar: 'أعيدوا الحركة', en: 'Replay' })}
          </button>
        </div>
        <div className="fl-head">{t({ ar: 'بعد التجربة والنقاش', en: 'Revised explanation' })}</div>
        {column(layout.from, 'from')}
        <div className="fl-mid" ref={ref} style={{ height: layout.height }} aria-hidden="true">
          {width > 0 && (
            <div key={`${run}:${moved}`}>
              <div className={`fl-reveal ${rtl ? 'is-rtl' : ''}`}>
                <svg width={width} height={layout.height}>
                  {layout.links.map((l) => (
                    <path key={`${l.from}>${l.to}`} className="fl-ribbon" data-change={classifyChange(l.from, l.to)} d={ribbonPath(l, sx, tx)} />
                  ))}
                  {layout.links.map((l) => {
                    const p = labelPoint(l, sx, tx);
                    return <text key={`t${l.from}>${l.to}`} className="fl-label" x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central">{n(l.count)}</text>;
                  })}
                </svg>
              </div>
              {layout.links.flatMap((l) => Array.from({ length: l.count }, (_, i) => {
                if (dots >= MAX_DOTS) return null;
                const order = dots++;
                const style = { offsetPath: `path('${laneAt(l, (i + 0.5) / l.count, sx, tx)}')`, animationDelay: `${600 + order * 90}ms` } as CSSProperties;
                return <span key={`${l.from}>${l.to}#${i}`} className="fl-dot" data-change={classifyChange(l.from, l.to)} style={style} />;
              }))}
            </div>
          )}
        </div>
        {column(layout.to, 'to')}
      </div>
      <figcaption className="fl-words">
        <ul>
          {layout.links.map((l) => {
            const change = classifyChange(l.from, l.to);
            return (
              <li key={`${l.from}>${l.to}`} data-change={change}>
                <b>{n(l.count)}</b>
                <span>{t(groupTitle(pack, l.from))} <Icon name="next" size={14} /> {t(groupTitle(pack, l.to))}</span>
                <span className="fl-change">{t(CHANGE_LABEL[change])}</span>
              </li>
            );
          })}
        </ul>
      </figcaption>
    </figure>
  );
}
