/** POST /api/teach {pack, text} → TeachResult. */
import { heuristicTeach } from '../src/brain/heuristic';
import { teachWithLLM } from '../src/brain/server';
import { bad, cleanText, logFallback, packFrom, readJson } from './_util';

export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  const pack = packFrom(body), text = cleanText(body?.text);
  if (!pack || !text) return bad();
  try { return Response.json(await teachWithLLM(pack, text)); }
  catch (e) { logFallback('teach', e); return Response.json({ ...heuristicTeach(pack, text), source: 'fallback' }); }
}
