/**
 * POST /api/class — the live class map.
 *   {action:'create', pack}            → {code}
 *   {action:'post', code, entry}       → {ok}   (a child's device, after each step)
 *   {action:'list', code}              → {pack, entries[], store}
 * Entries hold a pseudonym and idea summaries only: no names, no free text beyond the AI's one-line caption.
 */
import { ClassEntry } from '../src/contracts';
import { PACKS } from '../src/packs';
import { bad, readJson } from './_util';
import { classPack, createClass, listEntries, putEntry, storeKind } from './_store';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE = /^[A-Z2-9]{4}$/;

export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  const action = body?.action;
  try {
    if (action === 'create') {
      const pack = typeof body?.pack === 'string' && PACKS[body.pack] ? body.pack : null;
      if (!pack) return bad();
      const code = Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
      await createClass(code, pack);
      return Response.json({ code, store: storeKind() });
    }
    const code = typeof body?.code === 'string' ? body.code.toUpperCase() : '';
    if (!CODE.test(code)) return bad();
    const pack = await classPack(code);
    if (!pack) return Response.json({ error: 'no_class' }, { status: 404 });
    if (action === 'post') {
      const e = ClassEntry.safeParse(body?.entry);
      if (!e.success) return bad();
      await putEntry(code, { ...e.data, firstCaption: e.data.firstCaption.slice(0, 160), pseudonym: e.data.pseudonym.slice(0, 20) });
      return Response.json({ ok: true });
    }
    if (action === 'list') return Response.json({ pack, entries: await listEntries(code), store: storeKind() });
    return bad();
  } catch (e) {
    console.error('[class]', (e as Error).message);
    return Response.json({ error: 'store_failed' }, { status: 502 });
  }
}
