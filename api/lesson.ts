/**
 * POST /api/lesson (LessonInput) → LessonDraft: text for the teacher to review, never executable content. Whether
 * a supported interactive pack covers the topic is decided in code (matchPack), not by the model.
 */
import { LessonInput } from '../src/contracts';
import { fallbackLesson } from '../src/brain/lesson';
import { aiConfigured, lessonWithLLM } from '../src/brain/server';
import { accept, error, json, logError } from './_util';

export async function POST(request: Request): Promise<Response> {
  const got = await accept(request, LessonInput, 'draft', 32_768);
  if ('refuse' in got) return got.refuse;
  try {
    if (aiConfigured()) {
      try {
        return json(await lessonWithLLM(got.input));
      } catch (e) {
        logError('lesson', e);
      }
    }
    return json(fallbackLesson(got.input));
  } catch (e) {
    logError('lesson', e);
    return error('server_error', 500);
  }
}
