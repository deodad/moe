"use client";

import { Fragment, FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { AppState, ChatMessage, MaintenanceItem, Subject, ToolActivity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { MaintenanceCard } from "@/components/maintenance/maintenance-card";
import { MaintenanceRow } from "@/components/maintenance/maintenance-row";
import { SubjectCard } from "@/components/subjects/subject-card";
import { SubjectListItem } from "@/components/subjects/subject-list-item";

type View = "chat" | "subjects" | "maintenance";

const maintenanceGroups = [
  ["overdue", "Overdue"],
  ["this_week", "This week"],
  ["this_month", "This month"],
  ["later", "Later"],
] as const;

const suggestions = [
  "I just bought a 2026 4Runner. I want to keep it forever.",
  "What maintenance is coming up?",
  "I changed the oil yesterday.",
  "Show me what you know about my house.",
];

const activityFields: Record<string, string> = {
  search_subjects: "Searched inventory",
  get_subject: "Looked up",
  create_subject: "Item logged",
  update_subject: "Item updated",
  archive_subject: "Item archived",
  merge_subjects: "Items merged",
  get_history: "History checked",
  record_event: "Event logged",
  update_event: "Event corrected",
  list_maintenance: "Maintenance checked",
  create_maintenance: "Maintenance logged",
  update_maintenance: "Maintenance updated",
  web_search: "Searched the web",
  web_run: "Searched the web",
};

function parseToolResult(result: unknown): unknown {
  if (typeof result !== "string") return result;
  try { return JSON.parse(result) as unknown; } catch { return result; }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function resultSubject(result: unknown): Subject | null {
  const value = parseToolResult(result);
  const record = asRecord(value);
  const candidate = record && "subject" in record ? asRecord(record.subject) : record;
  if (!candidate || !("name" in candidate) || !("attributes" in candidate)) return null;
  return candidate as unknown as Subject;
}

function resultMaintenance(result: unknown): MaintenanceItem[] {
  const value = parseToolResult(result);
  const candidates = Array.isArray(value) ? value : asRecord(value) && "title" in (value as object) ? [value] : [];
  return candidates.filter((item) => item && typeof item === "object" && "timing" in item && (item as MaintenanceItem).status === "active") as MaintenanceItem[];
}

/** Plain-language description of what a tool call did, for the activity record row. */
function describeActivity(activity: ToolActivity): string {
  const args = activity.arguments ?? {};
  const result = asRecord(parseToolResult(activity.result));
  switch (activity.tool) {
    case "create_subject":
    case "update_subject":
      return String(args.name ?? result?.name ?? "—");
    case "archive_subject":
      return String(result?.name ?? "—");
    case "record_event":
    case "update_event":
      return String(args.summary ?? result?.summary ?? "—");
    case "create_maintenance":
      return String(args.title ?? "—");
    case "update_maintenance":
      return args.status === "done"
        ? `${String(args.title ?? result?.title ?? "item")} — done`
        : args.status === "archived"
          ? `${String(args.title ?? result?.title ?? "item")} — archived`
          : String(args.title ?? result?.title ?? "—");
    case "search_subjects":
    case "list_maintenance":
      return String(args.query ?? (args.subject_id ? "filtered by subject" : "all"));
    case "get_subject":
      return String(result?.name ?? args.id ?? "—");
    case "web_search":
    case "web_run":
      return String(args.query ?? args.input ?? "—");
    default: {
      const firstArgValue = Object.values(args).find((entry) => typeof entry === "string");
      return activity.summary ?? (firstArgValue ? String(firstArgValue) : "—");
    }
  }
}

/** Current-section marker, echoing the ● current-page dot on usgraphics.com's nav tabs. */
function NavDot({ active }: { active: boolean }) {
  return <span className={cn("size-1.5 shrink-0 rounded-full", active ? "bg-destructive" : "bg-transparent")} />;
}

function ToolActivityView({ activity, onMaintenanceAction }: {
  activity: ToolActivity;
  onMaintenanceAction: (id: string, action: "done" | "later") => Promise<void>;
}) {
  const subject = resultSubject(activity.result);
  const maintenance = resultMaintenance(activity.result);
  const field = activityFields[activity.tool] ?? activity.tool.replaceAll("_", " ");
  const value = describeActivity(activity);

  return (
    <div className="mt-3 max-w-xl space-y-2">
      <div className="grid grid-cols-[128px_1fr_auto] items-baseline gap-3 border border-border bg-card px-3 py-2 text-sm">
        <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{field}</span>
        <span className="truncate text-foreground">{value}</span>
        {activity.status === "running" && (
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">…</Badge>
        )}
        {activity.status === "error" && (
          <Badge variant="outline" className="border-destructive/50 bg-destructive/10 text-destructive">ERROR</Badge>
        )}
      </div>
      {subject && <SubjectCard subject={subject} compact />}
      {maintenance.length > 0 && (
        <div className="space-y-2">{maintenance.slice(0, 3).map((item) => <MaintenanceCard key={item.id} item={item} onAction={onMaintenanceAction} />)}</div>
      )}
    </div>
  );
}

function Message({ message, onMaintenanceAction }: {
  message: ChatMessage;
  onMaintenanceAction: (id: string, action: "done" | "later") => Promise<void>;
}) {
  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-[82%] bg-primary px-4 py-3 text-[15px] leading-6 text-primary-foreground">
        {message.text}
      </div>
    );
  }
  return (
    <div className="max-w-2xl">
      <div className="mb-2 font-mono text-xs font-semibold tracking-wide text-primary">{"// MOE"}</div>
      {message.activities?.map((activity) => <ToolActivityView key={activity.callId} activity={activity} onMaintenanceAction={onMaintenanceAction} />)}
      {message.text && (
        <ReactMarkdown
          components={{
            a: ({ children, href }) => (
              <a className="font-medium text-primary underline underline-offset-4" href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
            li: ({ children }) => <li className="ml-5 list-disc pl-1">{children}</li>,
            p: ({ children }) => <p className="mt-3 text-[15px] leading-7 text-foreground">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            ul: ({ children }) => <ul className="mt-2 space-y-1">{children}</ul>,
          }}
        >
          {message.text}
        </ReactMarkdown>
      )}
    </div>
  );
}

export function AppWorkspace({ initialState }: { initialState: AppState }) {
  const [state, setState] = useState(initialState);
  const [view, setView] = useState<View>("chat");
  const [activeConversationId, setActiveConversationId] = useState(initialState.conversations[0]?.id ?? "");
  const [selectedSubjectId, setSelectedSubjectId] = useState(initialState.subjects.find((subject) => subject.name === "4Runner")?.id ?? initialState.subjects[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [streamMessage, setStreamMessage] = useState<ChatMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const activeConversation = state.conversations.find((item) => item.id === activeConversationId) ?? state.conversations[0];
  const selectedSubject = state.subjects.find((item) => item.id === selectedSubjectId) ?? state.subjects[0];

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeConversation?.messages, streamMessage]);

  async function newConversation() {
    const response = await fetch("/api/conversations", { method: "POST" });
    const conversation = await response.json();
    setState((current) => ({ ...current, conversations: [conversation, ...current.conversations] }));
    setActiveConversationId(conversation.id);
    setView("chat");
  }

  async function maintenanceAction(id: string, action: "done" | "later") {
    const response = await fetch(`/api/maintenance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) return;
    const payload = await response.json() as { state: AppState };
    setState(payload.state);
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = message.trim();
    if (!text || sending) return;
    setMessage("");
    setError(null);
    setSending(true);

    const optimistic: ChatMessage = { id: `pending-user-${Date.now()}`, role: "user", text, createdAt: new Date().toISOString() };
    setState((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) => conversation.id === activeConversationId
        ? { ...conversation, messages: [...conversation.messages, optimistic] }
        : conversation),
    }));
    setStreamMessage({ id: "streaming", role: "assistant", text: "", createdAt: new Date().toISOString(), activities: [] });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConversationId, message: text }),
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({ error: "Chat request failed" })) as { error?: string };
        throw new Error(payload.error ?? "Chat request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const row of lines) {
          if (!row.trim()) continue;
          const payload = JSON.parse(row) as {
            type: string;
            text?: string;
            activity?: ToolActivity;
            error?: string;
            state?: AppState;
            conversationId?: string;
          };
          if (payload.type === "conversation" && payload.conversationId) setActiveConversationId(payload.conversationId);
          if (payload.type === "delta" && payload.text) {
            setStreamMessage((current) => current ? { ...current, text: current.text + payload.text } : current);
          }
          if (payload.type === "activity" && payload.activity) {
            setStreamMessage((current) => {
              if (!current) return current;
              const activities = [...(current.activities ?? [])];
              const index = activities.findIndex((item) => item.callId === payload.activity!.callId);
              if (index >= 0) activities[index] = payload.activity!; else activities.push(payload.activity!);
              return { ...current, activities };
            });
          }
          if (payload.type === "done" && payload.state) setState(payload.state);
          if (payload.type === "error") throw new Error(payload.error ?? "The agent turn failed");
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The agent turn failed");
    } finally {
      setStreamMessage(null);
      setSending(false);
    }
  }

  const viewTitle = view === "chat" ? activeConversation?.title || "New conversation" : view === "subjects" ? "Inventory" : "Maintenance";
  const viewDescription = view === "chat"
    ? "Your physical world, remembered"
    : view === "subjects"
      ? `${state.subjects.length} items in inventory`
      : "What deserves attention now";

  return (
    <SidebarProvider className="h-dvh min-h-0 overflow-hidden">
      <Sidebar>
        <SidebarHeader className="gap-4 px-2 py-3">
          <div className="flex items-center gap-3 px-2">
            <div className="flex size-8 shrink-0 items-center justify-center border border-line-strong font-mono text-sm font-semibold">
              M
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-[-0.01em]">Moe</p>
              <p className="truncate font-mono text-[0.68rem] tracking-wide text-muted-foreground uppercase">Maintenance agent</p>
            </div>
          </div>
          <Button onClick={newConversation} className="w-full">+ New chat</Button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="border border-border">
              <SidebarMenu>
                <SidebarMenuItem className="border-b border-border">
                  <SidebarMenuButton isActive={view === "chat"} onClick={() => setView("chat")} className="rounded-none">
                    <NavDot active={view === "chat"} /> Chat
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem className="border-b border-border">
                  <SidebarMenuButton isActive={view === "subjects"} onClick={() => setView("subjects")} className="rounded-none">
                    <NavDot active={view === "subjects"} /> Inventory
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={view === "maintenance"} onClick={() => setView("maintenance")} className="rounded-none">
                    <NavDot active={view === "maintenance"} /> Maintenance
                  </SidebarMenuButton>
                  <SidebarMenuBadge className="font-mono">{state.maintenance.length}</SidebarMenuBadge>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup className="min-h-0 flex-1">
            <SidebarGroupLabel className="font-mono tracking-wide uppercase">Recent</SidebarGroupLabel>
            <SidebarGroupContent className="flex min-h-0 flex-1 flex-col">
              <ScrollArea className="h-full">
                <SidebarMenu>
                  {state.conversations.map((conversation) => (
                    <SidebarMenuItem key={conversation.id}>
                      <SidebarMenuButton
                        isActive={activeConversationId === conversation.id && view === "chat"}
                        onClick={() => { setActiveConversationId(conversation.id); setView("chat"); }}
                      >
                        <span className="truncate">{conversation.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </ScrollArea>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <p className="border border-border bg-card p-3 text-xs leading-5 text-muted-foreground">
            A small, useful queue for the things you care about.
          </p>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-h-0">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mx-1 h-5" />
            <div className="min-w-0">
              <h1 className="truncate font-semibold tracking-[-0.01em]">{viewTitle}</h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{viewDescription}</p>
            </div>
          </div>
          <div className="flex shrink-0 font-mono text-[0.68rem] tracking-wide uppercase">
            <span className="border border-success/50 bg-success/10 px-2 py-1 text-success">Dev</span>
            <span className="border border-l-0 border-border px-2 py-1 text-muted-foreground">Local prototype</span>
          </div>
        </header>

        {view === "chat" && (
          <main className="flex min-h-0 flex-1 flex-col" aria-busy={sending}>
            <ScrollArea className="min-h-0 flex-1">
              <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
                {(!activeConversation || activeConversation.messages.length === 0) && !streamMessage ? (
                  <div className="py-[8vh] text-center">
                    <div className="mx-auto flex size-14 items-center justify-center border border-line-strong font-mono text-xl font-semibold">
                      M
                    </div>
                    <h2 className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-foreground">What are we taking care of?</h2>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                      Tell me what happened, ask about something you own, or work through what deserves attention next.
                    </p>
                    <div className="mx-auto mt-8 grid max-w-xl gap-2 text-left sm:grid-cols-2">
                      {suggestions.map((prompt) => (
                        <Card
                          key={prompt}
                          role="button"
                          tabIndex={0}
                          onClick={() => setMessage(prompt)}
                          onKeyDown={(event) => { if (event.key === "Enter") setMessage(prompt); }}
                          className="cursor-pointer p-4 text-sm leading-5 text-foreground transition hover:border-primary/50 hover:bg-accent/40"
                        >
                          {prompt}
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {activeConversation?.messages.map((item) => <Message key={item.id} message={item} onMaintenanceAction={maintenanceAction} />)}
                    {streamMessage && <Message message={streamMessage} onMaintenanceAction={maintenanceAction} />}
                    {sending && !streamMessage?.text && !streamMessage?.activities?.length && (
                      <div className="flex items-center gap-2 font-mono text-xs tracking-wide text-muted-foreground uppercase">
                        <span className="size-1.5 animate-pulse bg-primary" /> Thinking about your things…
                      </div>
                    )}
                  </div>
                )}
                {error && (
                  <div className="mt-6 border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
                )}
                <div ref={endRef} />
              </div>
            </ScrollArea>
            <div className="shrink-0 border-t bg-background px-4 py-4 sm:px-8">
              <form onSubmit={submit} className="mx-auto flex max-w-3xl items-end gap-2 border border-line-strong bg-card p-2 pl-4 focus-within:border-primary">
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }}
                  rows={1}
                  placeholder="Tell Moe what happened…"
                  className="max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent px-0 py-2 shadow-none focus-visible:ring-0"
                />
                <Button type="submit" size="icon" disabled={!message.trim() || sending} aria-label="Send message" className="font-mono">{"↑"}</Button>
              </form>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">Moe can make mistakes. Check important maintenance guidance.</p>
            </div>
          </main>
        )}

        {view === "subjects" && selectedSubject && (
          <ScrollArea className="min-h-0 flex-1">
            <main className="p-4 sm:p-8">
              <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[220px_1fr]">
                <section className="space-y-3">
                  <Input placeholder="Find an item" disabled />
                  <div className="border border-border">
                    {state.subjects.map((subject) => (
                      <SubjectListItem key={subject.id} subject={subject} selected={selectedSubject.id === subject.id} onClick={() => setSelectedSubjectId(subject.id)} />
                    ))}
                  </div>
                </section>
                <section className="space-y-4">
                  <SubjectCard subject={selectedSubject} maintenance={state.maintenance.filter((item) => item.subjectId === selectedSubject.id)} history={state.events.filter((item) => item.subjectId === selectedSubject.id)} />
                  <Button variant="outline" onClick={() => { setView("chat"); setMessage(`Tell me about my ${selectedSubject.name}.`); }}>
                    Ask about {selectedSubject.name}
                  </Button>
                </section>
              </div>
            </main>
          </ScrollArea>
        )}

        {view === "maintenance" && (
          <ScrollArea className="min-h-0 flex-1">
            <main className="p-4 sm:p-8">
              <div className="mx-auto max-w-4xl">
                <div className="mb-6 max-w-xl">
                  <h2 className="text-3xl font-semibold tracking-[-0.03em]">A useful attention queue.</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Broad timing windows, shaped around how you actually care for each item.</p>
                </div>
                <div className="border border-line-strong">
                  <Table>
                    <TableBody>
                      {maintenanceGroups.map(([timing, label]) => {
                        const items = state.maintenance.filter((item) => item.timing === timing);
                        return (
                          <Fragment key={timing}>
                            <TableRow className="border-b border-dashed hover:bg-transparent">
                              <TableCell colSpan={4} className="py-2 font-mono text-xs font-semibold tracking-wide text-foreground uppercase">
                                {label} · {items.length}
                              </TableCell>
                            </TableRow>
                            {items.length
                              ? items.map((item) => <MaintenanceRow key={item.id} item={item} onAction={maintenanceAction} />)
                              : (
                                <TableRow className="hover:bg-transparent">
                                  <TableCell colSpan={4} className="text-sm text-muted-foreground">Nothing here right now.</TableCell>
                                </TableRow>
                              )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </main>
          </ScrollArea>
        )}

        <nav className="grid h-14 shrink-0 grid-cols-3 divide-x divide-border border-t bg-background md:hidden">
          <button onClick={() => setView("chat")} className={cn("flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground", view === "chat" && "font-semibold text-foreground")}>
            <NavDot active={view === "chat"} /> Chat
          </button>
          <button onClick={() => setView("subjects")} className={cn("flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground", view === "subjects" && "font-semibold text-foreground")}>
            <NavDot active={view === "subjects"} /> Inventory
          </button>
          <button onClick={() => setView("maintenance")} className={cn("flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground", view === "maintenance" && "font-semibold text-foreground")}>
            <NavDot active={view === "maintenance"} /> Maintenance
          </button>
        </nav>
      </SidebarInset>
    </SidebarProvider>
  );
}
