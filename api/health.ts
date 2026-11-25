/** POST /api/health → {ai, liveStore}: what is configured. Never returns secrets. */
import { aiConfigured } from '../src/brain/server';
import { storeKind } from './_store';

export async function POST(): Promise<Response> {
  return Response.json({ ai: aiConfigured(), liveStore: storeKind() });
}
