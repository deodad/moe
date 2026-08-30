export type Timing = "overdue" | "this_week" | "this_month" | "later";
export type MaintenanceStatus = "active" | "done";

export type Thing = {
  id: string;
  name: string;
  category: string | null;
  attributes: Record<string, string>;
  carePreferences: string | null;
  createdAt: string;
};

export type HistoryEvent = {
  id: string;
  thingId: string | null;
  summary: string;
  occurredAt: string;
  data: Record<string, unknown>;
  createdAt: string;
};

export type MaintenanceItem = {
  id: string;
  thingId: string | null;
  thingName: string | null;
  title: string;
  status: MaintenanceStatus;
  timing: Timing;
  rationale: string | null;
  data: Record<string, unknown>;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ToolActivity = {
  callId: string;
  tool: string;
  status: "running" | "complete" | "error";
  summary?: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  activities?: ToolActivity[];
};

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

export type AppState = {
  things: Thing[];
  events: HistoryEvent[];
  maintenance: MaintenanceItem[];
  conversations: Conversation[];
};
