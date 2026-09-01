export type Timing = "overdue" | "this_week" | "this_month" | "later" | "watching";
export type MaintenanceStatus = "active" | "done" | "archived";

export type Subject = {
  id: string;
  name: string;
  category: string | null;
  attributes: Record<string, string>;
  carePreferences: string | null;
  archivedAt: string | null;
  mergedIntoId: string | null;
  createdAt: string;
};

export type HistoryEvent = {
  id: string;
  subjectId: string | null;
  summary: string;
  occurredAt: string;
  data: Record<string, unknown>;
  createdAt: string;
};

export type MaintenanceItem = {
  id: string;
  subjectId: string | null;
  subjectName: string | null;
  title: string;
  status: MaintenanceStatus;
  timing: Timing;
  due: {
    date?: string;
    condition?: string;
  };
  checkOn: string | null;
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
  subjects: Subject[];
  events: HistoryEvent[];
  maintenance: MaintenanceItem[];
  conversations: Conversation[];
};
