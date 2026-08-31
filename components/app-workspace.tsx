"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowUp,
  CheckCircle2,
  CircleEllipsis,
  Home,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { AppState, ChatMessage, MaintenanceItem, Thing, ToolActivity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Textarea } from "@/components/ui/textarea";
import { MaintenanceCard } from "@/components/maintenance/maintenance-card";
import { ThingCard } from "@/components/things/thing-card";
import { ThingListItem } from "@/components/things/thing-list-item";

type View = "chat" | "things" | "maintenance";

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

function parseToolResult(result: unknown): unknown {
  if (typeof result !== "string") return result;
  try { return JSON.parse(result) as unknown; } catch { return result; }
}

function resultThing(result: unknown): Thing | null {
  const value = parseToolResult(result);
  if (!value || typeof value !== "object") return null;
  const candidate = "thing" in value ? (value as { thing?: unknown }).thing : value;
  if (!candidate || typeof candidate !== "object" || !("name" in candidate) || !("attributes" in candidate)) return null;
  return candidate as Thing;
}

function resultMaintenance(result: unknown): MaintenanceItem[] {
  const value = parseToolResult(result);
  const candidates = Array.isArray(value) ? value : value && typeof value === "object" && "title" in value ? [value] : [];
  return candidates.filter((item) => item && typeof item === "object" && "timing" in item) as MaintenanceItem[];
}

function ToolActivityView({ activity, onMaintenanceAction }: {
  activity: ToolActivity;
  onMaintenanceAction: (id: string, action: "done" | "later") => Promise<void>;
}) {
  const thing = resultThing(activity.result);
  const maintenance = resultMaintenance(activity.result);
  const label = activity.tool.replaceAll("_", " ");
  return (
    <div className="mt-3 max-w-xl">
      <Badge variant={activity.status === "running" ? "secondary" : "outline"} className="mb-2">
        {activity.status === "running" ? <CircleEllipsis className="animate-pulse" /> : <CheckCircle2 className="text-primary" />}
        <span className="capitalize">{label}</span>
      </Badge>
      {thing && <ThingCard thing={thing} compact />}
      {maintenance.length > 0 && (
        <div className="space-y-2">{maintenance.slice(0, 3).map((item) => <MaintenanceCard key={item.id} item={item} compact onAction={onMaintenanceAction} />)}</div>
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
      <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-[15px] leading-6 text-primary-foreground">
        {message.text}
      </div>
    );
  }
  return (
    <div className="max-w-2xl">
      <div className="mb-2 flex items-center gap-2">
        <Avatar size="sm">
          <AvatarFallback className="bg-primary text-primary-foreground"><Sparkles className="size-3" /></AvatarFallback>
        </Avatar>
        <span className="text-xs font-semibold text-foreground">Moe</span>
      </div>
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
  const [selectedThingId, setSelectedThingId] = useState(initialState.things.find((thing) => thing.name === "4Runner")?.id ?? initialState.things[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [streamMessage, setStreamMessage] = useState<ChatMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const activeConversation = state.conversations.find((item) => item.id === activeConversationId) ?? state.conversations[0];
  const selectedThing = state.things.find((item) => item.id === selectedThingId) ?? state.things[0];

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

  const viewTitle = view === "chat" ? activeConversation?.title || "New conversation" : view === "things" ? "Things" : "Maintenance";
  const viewDescription = view === "chat"
    ? "Your physical world, remembered"
    : view === "things"
      ? `${state.things.length} things in your world`
      : "What deserves attention now";

  return (
    <SidebarProvider className="h-dvh min-h-0 overflow-hidden">
      <Sidebar>
        <SidebarHeader className="gap-4 px-2 py-3">
          <div className="flex items-center gap-3 px-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-[-0.01em]">Maintenance</p>
              <p className="truncate text-xs text-muted-foreground">of Everything</p>
            </div>
          </div>
          <Button onClick={newConversation} className="w-full"><Plus /> New chat</Button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={view === "chat"} onClick={() => setView("chat")}>
                    <MessageCircle /> Chat
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={view === "things"} onClick={() => setView("things")}>
                    <Home /> Things
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={view === "maintenance"} onClick={() => setView("maintenance")}>
                    <Wrench /> Maintenance
                  </SidebarMenuButton>
                  <SidebarMenuBadge>{state.maintenance.length}</SidebarMenuBadge>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup className="min-h-0 flex-1">
            <SidebarGroupLabel>Recent</SidebarGroupLabel>
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
          <p className="rounded-lg bg-accent p-3 text-xs leading-5 text-muted-foreground">
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
          <Badge variant="secondary" className="shrink-0">
            <span className="size-1.5 rounded-full bg-primary" /> Local prototype
          </Badge>
        </header>

        {view === "chat" && (
          <main className="flex min-h-0 flex-1 flex-col" aria-busy={sending}>
            <ScrollArea className="min-h-0 flex-1">
              <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
                {(!activeConversation || activeConversation.messages.length === 0) && !streamMessage ? (
                  <div className="py-[8vh] text-center">
                    <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                      <Sparkles className="size-6" />
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
                          className="cursor-pointer p-4 text-sm leading-5 text-foreground transition hover:border-primary/40 hover:bg-accent/40"
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
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="size-2 animate-pulse rounded-full bg-primary" /> Thinking about your things…
                      </div>
                    )}
                  </div>
                )}
                {error && (
                  <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
                )}
                <div ref={endRef} />
              </div>
            </ScrollArea>
            <div className="shrink-0 border-t bg-background px-4 py-4 sm:px-8">
              <form onSubmit={submit} className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border bg-card p-2 pl-4 shadow-sm focus-within:border-primary/50">
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }}
                  rows={1}
                  placeholder="Tell Moe what happened…"
                  className="max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent px-0 py-2 shadow-none focus-visible:ring-0"
                />
                <Button type="submit" size="icon" disabled={!message.trim() || sending} aria-label="Send message"><ArrowUp /></Button>
              </form>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">Moe can make mistakes. Check important maintenance guidance.</p>
            </div>
          </main>
        )}

        {view === "things" && selectedThing && (
          <ScrollArea className="min-h-0 flex-1">
            <main className="p-4 sm:p-8">
              <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[300px_1fr]">
                <section className="space-y-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Find a thing" className="pl-9" disabled />
                  </div>
                  <div className="space-y-2 pt-1">
                    {state.things.map((thing) => (
                      <ThingListItem key={thing.id} thing={thing} selected={selectedThing.id === thing.id} onClick={() => setSelectedThingId(thing.id)} />
                    ))}
                  </div>
                </section>
                <section className="space-y-4">
                  <ThingCard thing={selectedThing} maintenance={state.maintenance.filter((item) => item.thingId === selectedThing.id)} history={state.events.filter((item) => item.thingId === selectedThing.id)} />
                  <Button variant="outline" onClick={() => { setView("chat"); setMessage(`Tell me about my ${selectedThing.name}.`); }}>
                    <MessageCircle /> Ask about {selectedThing.name}
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
                <div className="mb-8 max-w-xl">
                  <h2 className="text-3xl font-semibold tracking-[-0.03em]">A useful attention queue.</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Broad timing windows, shaped around how you actually care for each thing.</p>
                </div>
                <div className="grid gap-8 md:grid-cols-2">
                  {maintenanceGroups.map(([timing, label]) => {
                    const items = state.maintenance.filter((item) => item.timing === timing);
                    return (
                      <section key={timing}>
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{label}</h3>
                          <span className="text-xs text-muted-foreground">{items.length}</span>
                        </div>
                        <div className="space-y-3">
                          {items.length
                            ? items.map((item) => <MaintenanceCard key={item.id} item={item} onAction={maintenanceAction} />)
                            : <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">Nothing here right now.</div>}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            </main>
          </ScrollArea>
        )}

        <nav className="grid h-14 shrink-0 grid-cols-3 border-t bg-background md:hidden">
          <button onClick={() => setView("chat")} className={cn("flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground", view === "chat" && "text-primary")}>
            <MessageCircle className="size-4" /> Chat
          </button>
          <button onClick={() => setView("things")} className={cn("flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground", view === "things" && "text-primary")}>
            <Home className="size-4" /> Things
          </button>
          <button onClick={() => setView("maintenance")} className={cn("flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground", view === "maintenance" && "text-primary")}>
            <Wrench className="size-4" /> Maintenance
          </button>
        </nav>
      </SidebarInset>
    </SidebarProvider>
  );
}
