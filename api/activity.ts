/** POST /api/activity (ActivityRequest: counts only) → ActivityPlan. Anything doubtful → the pack's own activity. */
import { ActivityRequest } from '../src/contracts';
import { fallbackActivity } from '../src/brain/classInsights';
import { activityWithLLM, aiConfigured, cleanActivityRequest, fitMinutes } from '../src/brain/server';
import type { ConceptPack } from '../src/packs/types';
import { accept, error, json, logError, packById } from './_util';

/** The offline activity, with step minutes that add up to the requested time. */
function offline(pack: ConceptPack, request: ActivityRequest) {
  const plan = fallbackActivity(pack, request);
  return { ...plan, steps: fitMinutes(plan.steps, request.minutes) };
}

export async function POST(request: Request): Promise<Response> {
  const got = await accept(request, ActivityRequest, 'draft', 16_384);
  if ('refuse' in got) return got.refuse;
  const pack = packById(got.input.pack);
  if (!pack) return error('bad_request', 400);
  const input = cleanActivityRequest(pack, got.input);
  try {
    if (aiConfigured()) {
      try {
        return json(await activityWithLLM(pack, input));
      } catch (e) {
        logError('activity', e);
      }
    }
    return json(offline(pack, input));
  } catch (e) {
    logError('activity', e);
    return error('server_error', 500);
  }
}
