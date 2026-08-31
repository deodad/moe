import { runWebSearch, WebSearchError } from "@/agent/web-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ error: "Web search is not configured." }, { status: 503 });
  }

  try {
    const input = await request.json() as unknown;
    const output = await runWebSearch(input, {
      apiKey,
      apiBaseUrl: process.env.OPENAI_API_BASE_URL,
    }, request.signal);
    return Response.json(output);
  } catch (error) {
    const known = error instanceof WebSearchError ? error : new WebSearchError("Web search is temporarily unavailable.");
    return Response.json({ error: known.message }, { status: known.status });
  }
}
