import { randomUUID } from "node:crypto";
import type { AgentEvent, SessionSnapshot } from "nanocodex";
import { AGENT_INSTRUCTIONS } from "@/agent/instructions";
import { createApplicationTools } from "@/agent/tools";
import { getDatabase } from "@/lib/database";
import type { ChatMessage, ToolActivity } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const encoder = new TextEncoder();
type NanocodexModel = "gpt-5.6-sol" | "gpt-5.6-terra" | "gpt-5.6-luna";

function line(value: unknown) {
  return encoder.encode(`${JSON.stringify(value)}\n`);
}

function titleFrom(text: string) {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 42 ? `${oneLine.slice(0, 39)}…` : oneLine;
}

function parsedResult(result: unknown) {
  if (typeof result !== "string") return result;
  try {
    return JSON.parse(result) as unknown;
  } catch {
    return result;
  }
}

function activityFromEvent(event: AgentEvent, activities: Map<string, ToolActivity>) {
  const payload = event.payload;
  const callId = typeof payload.call_id === "string" ? payload.call_id : `${event.request_id}-${event.seq}`;
  if (event.type === "tool.call") {
    const activity: ToolActivity = {
      callId,
      tool: typeof payload.tool === "string" ? payload.tool : "tool",
      status: "running",
      arguments: payload.arguments && typeof payload.arguments === "object"
        ? payload.arguments as Record<string, unknown>
        : undefined,
    };
    activities.set(callId, activity);
    return activity;
  }
  if (event.type === "tool.result") {
    const existing = activities.get(callId);
    const activity: ToolActivity = {
      callId,
      tool: existing?.tool ?? "tool",
      status: payload.status === "failed" ? "error" : "complete",
      arguments: existing?.arguments,
      result: parsedResult(payload.result),
    };
    activities.set(callId, activity);
    return activity;
  }
  return null;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured. Add it to .env.local to use the Nanocodex agent." },
      { status: 503 },
    );
  }

  const body = await request.json() as { conversationId?: string; message?: string };
  const message = body.message?.trim();
  if (!message) return Response.json({ error: "Message is required" }, { status: 400 });

  const db = getDatabase();
  const conversation = body.conversationId
    ? db.getConversation(body.conversationId)
    : db.createConversation();
  if (!conversation) return Response.json({ error: "Conversation not found" }, { status: 404 });

  const userMessage: ChatMessage = {
    id: randomUUID(),
    role: "user",
    text: message,
    createdAt: new Date().toISOString(),
  };
  const messages = [...conversation.messages, userMessage];
  const title = conversation.messages.length === 0 ? titleFrom(message) : conversation.title;
  db.saveConversation(conversation.id, { title, messages });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let agent: Awaited<ReturnType<(typeof import("nanocodex/node"))["Agent"]["create"]>> | undefined;
      let turn: ReturnType<NonNullable<typeof agent>["turn"]["prompt"]> | undefined;
      let watcher: ReturnType<NonNullable<typeof agent>["events"]["watch"]> | undefined;
      let unwatch: (() => void) | undefined;
      const activities = new Map<string, ToolActivity>();

      try {
        controller.enqueue(line({ type: "conversation", conversationId: conversation.id, userMessage }));
        const { Agent } = await import("nanocodex/node");
        const snapshot = db.getConversationSnapshot(conversation.id) as SessionSnapshot | null;
        const configuredModel = process.env.NANOCODEX_MODEL as NanocodexModel | undefined;
        const websocketUrl = process.env.NANOCODEX_WEBSOCKET_URL?.trim();
        const model: NanocodexModel = configuredModel && ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"].includes(configuredModel)
          ? configuredModel
          : "gpt-5.6-luna";

        agent = await Agent.create({
          apiKey,
          model,
          thinking: "low",
          reasoningMode: "standard",
          instructions: AGENT_INSTRUCTIONS,
          tools: createApplicationTools(db),
          toolMode: "direct",
          workspace: process.cwd(),
          ...(websocketUrl ? { websocketUrl } : {}),
          ...(snapshot ? { resume: snapshot } : {}),
        });

        watcher = agent.events.watch();
        unwatch = watcher.onEvent((event) => {
          if (event.type === "assistant.delta") {
            const text = typeof event.payload.text === "string" ? event.payload.text : "";
            if (text) controller.enqueue(line({ type: "delta", text }));
          }
          if (event.type === "tool.call" || event.type === "tool.result") {
            const activity = activityFromEvent(event, activities);
            if (activity) controller.enqueue(line({ type: "activity", activity }));
          }
        });

        turn = agent.turn.prompt({ input: message });
        const result = await turn.result();
        const assistantMessage: ChatMessage = {
          id: randomUUID(),
          role: "assistant",
          text: result.finalMessage,
          createdAt: new Date().toISOString(),
          activities: [...activities.values()],
        };
        const saved = db.saveConversation(conversation.id, {
          title,
          messages: [...messages, assistantMessage],
          snapshot: result.snapshot,
        });
        controller.enqueue(line({ type: "done", assistantMessage, conversation: saved, state: db.getState() }));
      } catch (error) {
        const detail = error instanceof Error ? error.message : "The Nanocodex turn failed";
        controller.enqueue(line({ type: "error", error: detail }));
      } finally {
        try {
          unwatch?.();
          watcher?.off();
          turn?.dispose();
          if (agent) await agent.session.shutdown();
        } finally {
          controller.close();
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
