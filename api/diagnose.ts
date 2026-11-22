/** POST /api/diagnose  {text, context} → Diagnosis.  On any AI failure returns the offline fallback (still 200). */
import { DiagnoseRequest } from '../src/contracts';
import { heuristicDiagnose } from '../src/brain/heuristic';
import { diagnoseWithClaude } from '../src/brain/server';

export async function POST(request: Request): Promise<Response> {
  let body: DiagnoseRequest;
  try {
    body = DiagnoseRequest.parse(await request.json());
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }
  try {
    return Response.json(await diagnoseWithClaude(body.text, body.context));
  } catch (e) {
    console.error('[diagnose] AI failed, using fallback:', (e as Error).message);
    return Response.json(heuristicDiagnose(body.text, body.context));
  }
}
