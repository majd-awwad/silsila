/** POST /api/activity {pack, entries[]} → ActivityPlan targeted at the class's most common wrong idea. */
import { z } from 'zod';
import { ClassEntry } from '../src/contracts';
import { fallbackActivity, summarise, summaryForAI } from '../src/brain/classInsights';
import { activityWithClaude } from '../src/brain/server';
import { bad, logFallback, packFrom, readJson } from './_util';

export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  const pack = packFrom(body);
  const entries = z.array(ClassEntry).max(200).safeParse(body?.entries);
  if (!pack || !entries.success) return bad();
  const s = summarise(pack, entries.data);
  const fb = fallbackActivity(pack, s.topWrong);
  try { return Response.json(await activityWithClaude(pack, summaryForAI(pack, s), fb)); }
  catch (e) { logFallback('activity', e); return Response.json({ ...fb, source: 'fallback' }); }
}
