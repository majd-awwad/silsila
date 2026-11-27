/** POST /api/transfer {pack, lang, text} → TransferResult: the learner explains a new situation on their own. */
import { AssessRequest } from '../src/contracts';
import { transfer } from './_ai';
import { accept, error, json, logError, packById } from './_util';

export async function POST(request: Request): Promise<Response> {
  const got = await accept(request, AssessRequest, 'ai', 8_192);
  if ('refuse' in got) return got.refuse;
  const pack = packById(got.input.pack), text = got.input.text.trim();
  if (!pack || !text) return error('bad_request', 400);
  try {
    return json(await transfer(pack, text));
  } catch (e) {
    logError('transfer', e);
    return error('server_error', 500);
  }
}
