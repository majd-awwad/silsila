/** POST /api/diagnose {text, context} → Diagnosis. Without a key or on any AI failure: the offline rules (200). */
import { DiagnoseRequest } from '../src/contracts';
import { diagnose } from './_ai';
import { accept, error, json, logError, packById } from './_util';

export async function POST(request: Request): Promise<Response> {
  const got = await accept(request, DiagnoseRequest, 'ai', 32_768);
  if ('refuse' in got) return got.refuse;
  const { text, context } = got.input;
  const pack = packById(context.pack);
  if (!pack || !text.trim()) return error('bad_request', 400);
  try {
    return json(await diagnose(pack, text.trim(), context));
  } catch (e) {
    logError('diagnose', e);
    return error('server_error', 500);
  }
}
