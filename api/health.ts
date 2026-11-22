/** POST /api/health → {ai: boolean}: whether an API key is configured. Never returns the key. */
export async function POST(): Promise<Response> {
  return Response.json({ ai: !!process.env.ANTHROPIC_API_KEY });
}
