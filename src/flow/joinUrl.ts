function baseUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function classroomJoinUrl(code: string, current: string, configured?: string, sample = false, area: 'join' | 'hw' = 'join'): string | null {
  const url = baseUrl((!sample && configured?.trim()) || current);
  if (!url) return null;
  const host = url.hostname.replace(/\.$/, '');
  if (!sample && (/^127\.|^0\.|^\[(?:::1|::|::ffff:7f[0-9a-f]{2}:[0-9a-f]+)\]$/.test(host) || host === 'localhost' || host.endsWith('.localhost'))) return null;
  url.search = '';
  url.hash = `/${area}/${encodeURIComponent(code)}`;
  return url.href;
}

export const joinUrl = (code: string, sample = false) => classroomJoinUrl(code, location.href, import.meta.env.VITE_CLASSROOM_BASE_URL, sample);

/** The link a learner opens to do a homework on their own device. */
export const homeworkUrl = (code: string) => classroomJoinUrl(code, location.href, import.meta.env.VITE_CLASSROOM_BASE_URL, false, 'hw');
