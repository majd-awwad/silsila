/** A tiny hash router: works on any static host and in the dev server, with deep links and Back. */
import { useEffect, useState } from 'react';

export interface Route {
  /** hash path segments: #/teacher/room/ABC234 → ['teacher','room','ABC234'] */
  path: string[];
  /** query of the hash (#/learn?pack=fractions) merged over the page query (?judge=1) */
  query: URLSearchParams;
}

export function parseRoute(hash: string, search = ''): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [p, q = ''] = raw.split('?');
  const query = new URLSearchParams(search);
  new URLSearchParams(q).forEach((v, k) => query.set(k, v));
  const path = p.split('/').filter(Boolean).map((s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  });
  // QR codes and links from the first version: ?class=CODE joins the classroom
  const legacy = query.get('class');
  if (!path.length && legacy) return { path: ['join', legacy.toUpperCase()], query };
  if (!path.length && query.get('judge') === '1') return { path: [query.has('quick') || query.has('pack') ? 'learn' : 'judge'], query };
  return { path, query };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash, location.search));
  useEffect(() => {
    const on = () => {
      setRoute(parseRoute(location.hash, location.search));
      scrollTo(0, 0);
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}

/** navigate('/teacher/new') */
export function navigate(to: string): void {
  location.hash = to.startsWith('#') ? to : `#${to}`;
}

export const href = (to: string) => `#${to}`;

/** Absolute link for QR codes. */
export const absoluteLink = (to: string) => `${location.origin}${location.pathname}#${to}`;
