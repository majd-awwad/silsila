/** POST /api/teach  {text} → TeachResult.  Falls back to the offline check if the AI fails. */
import { z } from 'zod';
import { heuristicTeach } from '../src/brain/heuristic';
import { teachWithClaude } from '../src/brain/server';

const Body = z.object({ text: z.string().min(1).max(600) });

export async function POST(request: Request): Promise<Response> {
  let text: string;
  try {
    text = Body.parse(await request.json()).text;
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }
  try {
    return Response.json(await teachWithClaude(text));
  } catch (e) {
    console.error('[teach] AI failed, using fallback:', (e as Error).message);
    return Response.json({ ...heuristicTeach(text), source: 'fallback' });
  }
}
