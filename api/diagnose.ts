/** POST /api/diagnose {text, context} → Diagnosis. On any AI failure returns the offline fallback (still 200). */
import { DiagnoseRequest } from '../src/contracts';
import { heuristicDiagnose } from '../src/brain/heuristic';
import { diagnoseWithLLM } from '../src/brain/server';
import { getPack, PACKS } from '../src/packs';
import { bad, logFallback } from './_util';

export async function POST(request: Request): Promise<Response> {
  let body: DiagnoseRequest;
  try { body = DiagnoseRequest.parse(await request.json()); } catch { return bad(); }
  if (!PACKS[body.context.pack]) return bad();
  const pack = getPack(body.context.pack);
  try {
    return Response.json(await diagnoseWithLLM(pack, body.text, body.context));
  } catch (e) {
    logFallback('diagnose', e);
    return Response.json(heuristicDiagnose(pack, body.text, body.context));
  }
}
