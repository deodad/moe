import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { AgentEvent, TurnUsage } from "nanocodex";
import { Agent, Transport } from "nanocodex/node";
import { agentInstructionsWithSubjects } from "@/agent/context";
import { createApplicationTools } from "@/agent/tools";
import { createWebSearchTool } from "@/agent/web-search";
import { MoeDatabase } from "@/lib/database";
import type { ToolActivity } from "@/lib/types";

type EvalCase = {
  case: string;
  initialSubjects?: Array<{
    key?: string;
    name: string;
    category?: string | null;
    attributes?: Record<string, string>;
    carePreferences?: string | null;
  }>;
  initialEvents?: Array<{
    subjectKey?: string;
    summary: string;
    occurredAt?: string;
    data?: Record<string, unknown>;
  }>;
  initialMaintenance?: Array<{
    subjectKey?: string;
    title: string;
    timing?: "overdue" | "this_week" | "this_month" | "later";
    rationale?: string | null;
    data?: Record<string, unknown>;
  }>;
  turns: string[];
};

type SupportedModel = "gpt-5.6-sol" | "gpt-5.6-terra" | "gpt-5.6-luna";
type Usage = {
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
};

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function modelName(value: string | undefined): SupportedModel {
  const model = value?.includes("/") ? value.split("/").at(-1) : value;
  if (model === "gpt-5.6-sol" || model === "gpt-5.6-terra" || model === "gpt-5.6-luna") return model;
  throw new Error(`Unsupported Moe model: ${value ?? "missing"}`);
}

async function stdin() {
  let value = "";
  for await (const chunk of process.stdin) value += chunk;
  return value;
}

function loadLocalEnvironment() {
  for (const file of [".env.local", ".env"]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

function addUsage(total: Usage, usage: TurnUsage) {
  total.input_tokens += usage.input_tokens;
  total.cached_input_tokens += usage.cached_input_tokens;
  total.cache_write_input_tokens += usage.cache_write_input_tokens;
  total.output_tokens += usage.output_tokens;
  total.reasoning_output_tokens += usage.reasoning_output_tokens;
  total.total_tokens += usage.total_tokens;
}

function parsedResult(result: unknown) {
  if (typeof result !== "string") return result;
  try {
    return JSON.parse(result) as unknown;
  } catch {
    return result;
  }
}

async function main() {
  loadLocalEnvironment();
  const outputPath = argument("--output");
if (!outputPath) throw new Error("--output is required");
const model = modelName(argument("--model"));
const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) throw new Error("OPENAI_API_KEY is required");

const spec = JSON.parse(await stdin()) as EvalCase;
if (!spec.case || !Array.isArray(spec.turns) || spec.turns.length === 0) {
  throw new Error("The Harbor instruction must contain a case name and at least one turn");
}

const tempDirectory = mkdtempSync(join(tmpdir(), "moe-eval-"));
process.env.MOE_DATABASE_PATH = join(tempDirectory, "moe.db");
const db = new MoeDatabase(process.env.MOE_DATABASE_PATH, false);
const subjectIds = new Map<string, string>();
for (const { key, ...subject } of spec.initialSubjects ?? []) {
  const created = db.createSubject(subject);
  if (key) subjectIds.set(key, created.id);
}
for (const { subjectKey, ...event } of spec.initialEvents ?? []) {
  db.recordEvent({ ...event, subjectId: subjectKey ? subjectIds.get(subjectKey) : undefined });
}
for (const { subjectKey, ...maintenance } of spec.initialMaintenance ?? []) {
  db.createMaintenance({ ...maintenance, subjectId: subjectKey ? subjectIds.get(subjectKey) : undefined });
}
const initialState = db.getState();
const webTool = createWebSearchTool({ apiKey, apiBaseUrl: process.env.OPENAI_API_BASE_URL });
const agent = await Agent.create({
  transport: Transport.openAi({ apiKey }),
  model,
  thinking: "low",
  reasoningMode: "standard",
  instructions: agentInstructionsWithSubjects(db.listSubjects()),
  tools: { ...createApplicationTools(db), [webTool.name]: webTool },
  toolMode: "direct",
  workspace: process.cwd(),
});

const usage: Usage = {
  input_tokens: 0,
  cached_input_tokens: 0,
  cache_write_input_tokens: 0,
  output_tokens: 0,
  reasoning_output_tokens: 0,
  total_tokens: 0,
};
const turns: Array<Record<string, unknown>> = [];
let currentTools = new Map<string, ToolActivity>();
const watcher = agent.events.watch();
const unwatch = watcher.onEvent((event: AgentEvent) => {
  const callId = typeof event.payload.call_id === "string" ? event.payload.call_id : `${event.request_id}-${event.seq}`;
  if (event.type === "tool.call") {
    currentTools.set(callId, {
      callId,
      tool: typeof event.payload.tool === "string" ? event.payload.tool : "tool",
      status: "running",
      arguments: event.payload.arguments && typeof event.payload.arguments === "object"
        ? event.payload.arguments as Record<string, unknown>
        : undefined,
    });
  }
  if (event.type === "tool.result") {
    const existing = currentTools.get(callId);
    currentTools.set(callId, {
      callId,
      tool: existing?.tool ?? "tool",
      status: event.payload.status === "failed" ? "error" : "complete",
      arguments: existing?.arguments,
      result: event.payload.status === "failed" ? event.payload.error : parsedResult(event.payload.result),
    });
  }
});

try {
  for (const input of spec.turns) {
    currentTools = new Map<string, ToolActivity>();
    const turn = agent.turn.prompt({ input });
    const result = await turn.result();
    try {
      addUsage(usage, await result.usage());
      turns.push({
        input,
        output: result.finalMessage,
        tools: [...currentTools.values()],
        state: db.getState(),
      });
    } finally {
      result.dispose();
      turn.dispose();
    }
  }

  writeFileSync(resolve(outputPath), JSON.stringify({
    case: spec.case,
    model,
    initialState,
    turns,
    finalState: db.getState(),
    usage,
  }, null, 2));
} finally {
  unwatch();
  watcher.off();
  await agent.session.shutdown();
  agent.dispose();
  db.close();
  rmSync(tempDirectory, { recursive: true, force: true });
}
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
