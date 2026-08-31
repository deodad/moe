import { web } from "nanocodex/tools";

type WebSearchRequest = {
  commands: Record<string, unknown>;
  session_id: string;
};

type WebSearchOptions = {
  apiKey: string;
  apiBaseUrl?: string;
};

const MAX_RESPONSE_BYTES = 1024 * 1024;
export const WEB_SEARCH_MODEL = "gpt-5.6-terra";

export class WebSearchError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

function request(input: unknown): WebSearchRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new WebSearchError("Invalid web search request.", 400);
  }
  const value = input as Record<string, unknown>;
  if (!value.commands || typeof value.commands !== "object" || Array.isArray(value.commands)) {
    throw new WebSearchError("Invalid web search commands.", 400);
  }
  if (typeof value.session_id !== "string" || !value.session_id.trim()) {
    throw new WebSearchError("Invalid web search session.", 400);
  }
  return {
    commands: value.commands as Record<string, unknown>,
    session_id: value.session_id,
  };
}

export async function runWebSearch(
  input: unknown,
  options: WebSearchOptions,
  signal?: AbortSignal | null,
) {
  const body = request(input);
  const apiBaseUrl = options.apiBaseUrl?.trim() || "https://api.openai.com/v1";
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/alpha/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "moe-local-prototype",
    },
    body: JSON.stringify({
      id: body.session_id,
      model: WEB_SEARCH_MODEL,
      commands: body.commands,
      settings: {
        allowed_callers: ["direct"],
        external_web_access: true,
      },
      max_output_tokens: 8_000,
    }),
    redirect: "manual",
    signal: signal ?? undefined,
  });

  if (response.status >= 300 && response.status < 400) {
    throw new WebSearchError("Web search redirects are not allowed.");
  }
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new WebSearchError("Web search returned too much data.");
  }
  if (!response.ok) {
    throw new WebSearchError(
      response.status === 401 || response.status === 403
        ? "Web search is not available for this API key."
        : "Web search is temporarily unavailable.",
      response.status,
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new WebSearchError("Web search returned an invalid response.");
  }
  if (!payload || typeof payload !== "object" || typeof (payload as { output?: unknown }).output !== "string") {
    throw new WebSearchError("Web search returned an invalid response.");
  }
  return payload as { output: string; results?: unknown };
}

export function createWebSearchTool(options: WebSearchOptions) {
  return web({
    url: "https://moe.invalid/api/tools/web-search",
    async fetch(_input, init) {
      try {
        const input = JSON.parse(String(init?.body ?? "null")) as unknown;
        return Response.json(await runWebSearch(input, options, init?.signal));
      } catch (error) {
        const known = error instanceof WebSearchError ? error : new WebSearchError("Web search is temporarily unavailable.");
        return Response.json({ error: known.message }, { status: known.status });
      }
    },
  });
}
