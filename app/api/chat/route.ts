import { randomUUID } from "node:crypto";
import type { AgentEvent, SessionSnapshot } from "nanocodex";
import { agentInstructionsWithSubjects } from "@/agent/context";
import { createApplicationTools } from "@/agent/tools";
import { createWebSearchTool } from "@/agent/web-search";
import { getDatabase } from "@/lib/database";
import type { ChatMessage, ToolActivity } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const encoder = new TextEncoder();
const TURN_TIMEOUT_MS = 90_000;
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
      result: payload.status === "failed"
        ? "This tool could not complete the request."
        : parsedResult(payload.result),
    };
    activities.set(callId, activity);
    return activity;
  }
  return null;
}

function publicTurnError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/rate.?limit|429|capacity/i.test(message)) {
    return "Moe is busy right now. Please try again in a moment.";
  }
  if (/401|403|api.?key|authentication|unauthorized/i.test(message)) {
    return "Moe could not authenticate with the model service. Check the local API-key configuration.";
  }
  return "Moe could not finish that response. Please try again.";
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured. Add it to .env.local to use the Nanocodex agent." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null) as { conversationId?: string; message?: string; subjectId?: string } | null;
  if (!body) return Response.json({ error: "Invalid chat request" }, { status: 400 });
  const message = body.message?.trim();
  if (!message) return Response.json({ error: "Message is required" }, { status: 400 });

  const db = getDatabase();
  const focusedSubject = body.subjectId ? db.getSubject(body.subjectId) : null;
  if (body.subjectId && !focusedSubject) return Response.json({ error: "Subject not found" }, { status: 404 });
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

  let cancelled = false;
  let cancelTurn: (() => Promise<void>) | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let agent: Awaited<ReturnType<(typeof import("nanocodex/node"))["Agent"]["create"]>> | undefined;
      let turn: ReturnType<NonNullable<typeof agent>["turn"]["prompt"]> | undefined;
      let watcher: ReturnType<NonNullable<typeof agent>["events"]["watch"]> | undefined;
      let unwatch: (() => void) | undefined;
      let turnTimeout: ReturnType<typeof setTimeout> | undefined;
      let timedOut = false;
      const activities = new Map<string, ToolActivity>();
      const enqueue = (value: unknown) => {
        if (cancelled) return false;
        try {
          controller.enqueue(line(value));
          return true;
        } catch {
          cancelled = true;
          return false;
        }
      };

      try {
        enqueue({ type: "conversation", conversationId: conversation.id, userMessage });
        const { Agent, Transport } = await import("nanocodex/node");
        const snapshot = db.getConversationSnapshot(conversation.id) as SessionSnapshot | null;
        const configuredModel = process.env.NANOCODEX_MODEL as NanocodexModel | undefined;
        const websocketUrl = process.env.NANOCODEX_WEBSOCKET_URL?.trim();
        const model: NanocodexModel = configuredModel && ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"].includes(configuredModel)
          ? configuredModel
          : "gpt-5.6-luna";

        const webTool = createWebSearchTool({
          apiKey,
          apiBaseUrl: process.env.OPENAI_API_BASE_URL,
        });
        agent = await Agent.create({
          transport: Transport.openAi({
            apiKey,
            ...(websocketUrl ? { websocketUrl } : {}),
          }),
          model,
          thinking: "low",
          reasoningMode: "standard",
          instructions: agentInstructionsWithSubjects(db.listSubjects(), focusedSubject),
          tools: {
            ...createApplicationTools(db),
            [webTool.name]: webTool,
          },
          toolMode: "direct",
          workspace: process.cwd(),
          ...(snapshot ? { resume: snapshot } : {}),
        });

        watcher = agent.events.watch();
        unwatch = watcher.onEvent((event) => {
          if (event.type === "assistant.delta") {
            const text = typeof event.payload.text === "string" ? event.payload.text : "";
            if (text) enqueue({ type: "delta", text });
          }
          if (event.type === "tool.call" || event.type === "tool.result") {
            const activity = activityFromEvent(event, activities);
            if (activity) enqueue({ type: "activity", activity });
          }
        });

        turn = agent.turn.prompt({ input: message });
        cancelTurn = () => turn!.cancel();
        turnTimeout = setTimeout(() => {
          timedOut = true;
          void turn?.cancel().catch(() => undefined);
        }, TURN_TIMEOUT_MS);
        const result = await turn.result();
        try {
          if (cancelled) return;
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
            snapshot: await result.snapshot(),
          });
          enqueue({ type: "done", assistantMessage, conversation: saved, state: db.getState() });
        } finally {
          result.dispose();
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Nanocodex turn failed", error);
          enqueue({
            type: "error",
            error: timedOut ? "Moe took too long to finish. Please try that request again." : publicTurnError(error),
          });
        }
      } finally {
        try {
          if (turnTimeout) clearTimeout(turnTimeout);
          unwatch?.();
          watcher?.off();
          turn?.dispose();
          if (agent) await agent.session.shutdown();
        } finally {
          if (!cancelled) controller.close();
        }
      }
    },
    async cancel() {
      cancelled = true;
      try {
        await cancelTurn?.();
      } catch {
        // The turn may already have reached a terminal state.
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
