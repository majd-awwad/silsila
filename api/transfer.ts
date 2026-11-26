/** POST /api/transfer {pack, text} → TransferResult: the child explains a new phenomenon on their own. */
import { heuristicTransfer } from '../src/brain/heuristic';
import { transferWithLLM } from '../src/brain/server';
import { bad, cleanText, logFallback, packFrom, readJson } from './_util';

export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  const pack = packFrom(body), text = cleanText(body?.text);
  if (!pack || !text) return bad();
  try { return Response.json(await transferWithLLM(pack, text)); }
  catch (e) { logFallback('transfer', e); return Response.json({ ...heuristicTransfer(pack, text), source: 'fallback' }); }
}
