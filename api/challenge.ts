/** POST /api/challenge {pack, teachings[]} → ChallengeResult: Noor explains a new phenomenon from the child's teaching only. */
import { heuristicChallenge } from '../src/brain/heuristic';
import { challengeWithLLM } from '../src/brain/server';
import { bad, logFallback, packFrom, readJson } from './_util';

export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  const pack = packFrom(body);
  const teachings = Array.isArray(body?.teachings) ? body!.teachings.filter((t): t is string => typeof t === 'string').map((t) => t.slice(0, 600)).slice(-8) : [];
  if (!pack || !teachings.length) return bad();
  try { return Response.json(await challengeWithLLM(pack, teachings)); }
  catch (e) { logFallback('challenge', e); return Response.json({ ...heuristicChallenge(pack, teachings), source: 'fallback' }); }
}
