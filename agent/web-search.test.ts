import { afterEach, describe, expect, it, vi } from "vitest";
import { createWebSearchTool, runWebSearch, WEB_SEARCH_MODEL } from "@/agent/web-search";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("web search", () => {
  it("sends canonical commands to the Nanocodex search boundary", async () => {
    const upstream = vi.fn<typeof fetch>(async () => Response.json({
      output: "Dyson support instructions (https://www.dyson.com/support)",
      results: [{ title: "Dyson support", url: "https://www.dyson.com/support" }],
    }));
    vi.stubGlobal("fetch", upstream);

    const result = await runWebSearch({
      session_id: "conversation-1",
      commands: { search_query: [{ q: "Dyson V15 filter cleaning official video" }] },
    }, { apiKey: "test-key" });

    expect(result.output).toContain("Dyson support");
    expect(upstream).toHaveBeenCalledOnce();
    const [url, init] = upstream.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/alpha/search");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      id: "conversation-1",
      model: WEB_SEARCH_MODEL,
      commands: { search_query: [{ q: "Dyson V15 filter cleaning official video" }] },
      settings: { allowed_callers: ["direct"], external_web_access: true },
    });
  });

  it("exposes the canonical web__run tool while keeping credentials server-side", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ output: "Search result" })));
    const tool = createWebSearchTool({ apiKey: "server-only-key" });

    expect(tool.name).toBe("web__run");
    await expect(tool.handler(
      { search_query: [{ q: "Dyson filter video" }] },
      {
        callId: "call-1",
        parentCallId: "",
        sessionId: "conversation-1",
        signal: new AbortController().signal,
      },
    )).resolves.toBe("Search result");
  });

  it("returns a safe error when upstream authentication is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(
      { error: { message: "internal credential detail" } },
      { status: 401 },
    )));

    await expect(runWebSearch({
      session_id: "conversation-1",
      commands: { search_query: [{ q: "Dyson" }] },
    }, { apiKey: "bad-key" })).rejects.toMatchObject({
      message: "Web search is not available for this API key.",
      status: 401,
    });
  });
});
