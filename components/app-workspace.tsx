"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleEllipsis,
  Home,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import type { AppState, ChatMessage, MaintenanceItem, Thing, ToolActivity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MaintenanceCard } from "@/components/maintenance/maintenance-card";
import { ThingCard } from "@/components/things/thing-card";

type View = "chat" | "things" | "maintenance";

const maintenanceGroups = [
  ["overdue", "Overdue"],
  ["this_week", "This week"],
  ["this_month", "This month"],
  ["later", "Later"],
] as const;

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
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-stone-500">
        {activity.status === "running" ? <CircleEllipsis className="size-3.5 animate-pulse" /> : <CheckCircle2 className="size-3.5 text-emerald-700" />}
        <span className="capitalize">{label}</span>
      </div>
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
    return <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-stone-900 px-4 py-3 text-[15px] leading-6 text-white">{message.text}</div>;
  }
  return (
    <div className="max-w-2xl">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-800"><Bot className="size-4" /> Moe</div>
      {message.activities?.map((activity) => <ToolActivityView key={activity.callId} activity={activity} onMaintenanceAction={onMaintenanceAction} />)}
      {message.text && <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-stone-800">{message.text}</p>}
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
  const [mobileMenu, setMobileMenu] = useState(false);
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
    setMobileMenu(false);
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

  function chooseView(next: View) {
    setView(next);
    setMobileMenu(false);
  }

  const nav = (
    <>
      <button onClick={() => chooseView("chat")} className={cn("nav-item", view === "chat" && "nav-item-active")}><MessageCircle /> Chat</button>
      <button onClick={() => chooseView("things")} className={cn("nav-item", view === "things" && "nav-item-active")}><Home /> Things</button>
      <button onClick={() => chooseView("maintenance")} className={cn("nav-item", view === "maintenance" && "nav-item-active")}><Wrench /> Maintenance <span className="ml-auto rounded-full bg-white/10 px-2 text-[11px]">{state.maintenance.length}</span></button>
    </>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-[#f7f6f1] text-stone-900">
      <aside className="hidden w-[278px] shrink-0 flex-col bg-[#173e35] px-4 py-5 text-white lg:flex">
        <div className="flex items-center gap-3 px-3">
          <div className="grid size-10 place-items-center rounded-xl bg-[#e5f275] text-[#173e35]"><Sparkles className="size-5" /></div>
          <div><p className="font-semibold tracking-[-0.02em]">Maintenance</p><p className="text-xs text-emerald-100/60">of Everything</p></div>
        </div>
        <Button onClick={newConversation} className="mt-7 w-full bg-white text-[#173e35] hover:bg-emerald-50"><Plus className="size-4" /> New chat</Button>
        <nav className="mt-5 space-y-1">{nav}</nav>
        <div className="mt-8 min-h-0 flex-1 overflow-y-auto px-2">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/50">Recent</p>
          <div className="space-y-1">
            {state.conversations.slice(0, 7).map((conversation) => (
              <button key={conversation.id} onClick={() => { setActiveConversationId(conversation.id); setView("chat"); }} className={cn("w-full truncate rounded-lg px-2 py-2 text-left text-sm text-emerald-50/65 hover:bg-white/5 hover:text-white", activeConversationId === conversation.id && "bg-white/8 text-white")}>{conversation.title}</button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-emerald-50/60">A small, useful queue for the things you care about.</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200/80 bg-[#f7f6f1]/90 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button className="grid size-9 place-items-center rounded-full border border-stone-300 lg:hidden" onClick={() => setMobileMenu(true)} aria-label="Open navigation"><Menu className="size-4" /></button>
            <div><h1 className="font-semibold tracking-[-0.02em]">{view === "chat" ? activeConversation?.title || "New conversation" : view === "things" ? "Things" : "Maintenance"}</h1><p className="hidden text-xs text-stone-500 sm:block">{view === "chat" ? "Your physical world, remembered" : view === "things" ? `${state.things.length} things in your world` : "What deserves attention now"}</p></div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"><span className="size-1.5 rounded-full bg-emerald-600" /> Local prototype</span>
        </header>

        {view === "chat" && (
          <main className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8">
              <div className="mx-auto max-w-3xl">
                {(!activeConversation || activeConversation.messages.length === 0) && !streamMessage ? (
                  <div className="py-[8vh] text-center">
                    <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-800"><Sparkles className="size-6" /></div>
                    <h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-stone-950">What are we taking care of?</h2>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-500">Tell me what happened, ask about something you own, or work through what deserves attention next.</p>
                    <div className="mx-auto mt-8 grid max-w-xl gap-2 text-left sm:grid-cols-2">
                      {["I just bought a 2026 4Runner. I want to keep it forever.", "What maintenance is coming up?", "I changed the oil yesterday.", "Show me what you know about my house."].map((prompt) => (
                        <button key={prompt} onClick={() => setMessage(prompt)} className="rounded-xl border border-stone-200 bg-white p-4 text-sm leading-5 text-stone-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/30">{prompt}<ChevronRight className="mt-3 size-4 text-stone-400" /></button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {activeConversation?.messages.map((item) => <Message key={item.id} message={item} onMaintenanceAction={maintenanceAction} />)}
                    {streamMessage && <Message message={streamMessage} onMaintenanceAction={maintenanceAction} />}
                    {sending && !streamMessage?.text && !streamMessage?.activities?.length && <div className="flex items-center gap-2 text-sm text-stone-500"><span className="size-2 animate-pulse rounded-full bg-emerald-700" /> Thinking about your things…</div>}
                  </div>
                )}
                {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
                <div ref={endRef} />
              </div>
            </div>
            <div className="shrink-0 border-t border-stone-200/70 bg-[#f7f6f1] px-4 py-4 sm:px-8">
              <form onSubmit={submit} className="mx-auto flex max-w-3xl items-end gap-2 rounded-[22px] border border-stone-300 bg-white p-2 pl-4 shadow-[0_8px_30px_rgba(28,25,23,.08)] focus-within:border-emerald-700">
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} rows={1} placeholder="Tell Moe what happened…" className="max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-stone-400" />
                <Button size="icon" disabled={!message.trim() || sending} aria-label="Send message"><ArrowUp className="size-4" /></Button>
              </form>
              <p className="mt-2 text-center text-[10px] text-stone-400">Moe can make mistakes. Check important maintenance guidance.</p>
            </div>
          </main>
        )}

        {view === "things" && selectedThing && (
          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[300px_1fr]">
              <section>
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-stone-400"><Search className="size-4" /><span className="text-sm">Find a thing</span></div>
                <div className="space-y-2">
                  {state.things.map((thing) => (
                    <button key={thing.id} onClick={() => setSelectedThingId(thing.id)} className={cn("flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left", selectedThing.id === thing.id ? "border-emerald-700 ring-1 ring-emerald-700" : "border-stone-200")}>
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-600"><Home className="size-4" /></span>
                      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{thing.name}</span><span className="block truncate text-xs text-stone-500">{thing.category}</span></span>
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <ThingCard thing={selectedThing} maintenance={state.maintenance.filter((item) => item.thingId === selectedThing.id)} history={state.events.filter((item) => item.thingId === selectedThing.id)} />
                <Button className="mt-4" variant="outline" onClick={() => { setView("chat"); setMessage(`Tell me about my ${selectedThing.name}.`); }}><MessageCircle className="size-4" /> Ask about {selectedThing.name}</Button>
              </section>
            </div>
          </main>
        )}

        {view === "maintenance" && (
          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="mx-auto max-w-4xl">
              <div className="mb-8 max-w-xl"><h2 className="text-3xl font-semibold tracking-[-0.04em]">A useful attention queue.</h2><p className="mt-2 text-sm leading-6 text-stone-500">Broad timing windows, shaped around how you actually care for each thing.</p></div>
              <div className="grid gap-8 md:grid-cols-2">
                {maintenanceGroups.map(([timing, label]) => {
                  const items = state.maintenance.filter((item) => item.timing === timing);
                  return (
                    <section key={timing}>
                      <div className="mb-3 flex items-center justify-between"><h3 className="text-[11px] font-bold uppercase tracking-[0.17em] text-stone-500">{label}</h3><span className="text-xs text-stone-400">{items.length}</span></div>
                      <div className="space-y-3">{items.length ? items.map((item) => <MaintenanceCard key={item.id} item={item} onAction={maintenanceAction} />) : <div className="rounded-2xl border border-dashed border-stone-300 p-5 text-sm text-stone-400">Nothing here right now.</div>}</div>
                    </section>
                  );
                })}
              </div>
            </div>
          </main>
        )}

        <nav className="grid h-16 shrink-0 grid-cols-3 border-t border-stone-200 bg-white lg:hidden">
          <button onClick={() => chooseView("chat")} className={cn("mobile-nav", view === "chat" && "text-emerald-800")}><MessageCircle />Chat</button>
          <button onClick={() => chooseView("things")} className={cn("mobile-nav", view === "things" && "text-emerald-800")}><Home />Things</button>
          <button onClick={() => chooseView("maintenance")} className={cn("mobile-nav", view === "maintenance" && "text-emerald-800")}><Wrench />Maintenance</button>
        </nav>
      </div>

      {mobileMenu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/30" onClick={() => setMobileMenu(false)} aria-label="Close navigation" />
          <aside className="relative flex h-full w-[82%] max-w-xs flex-col bg-[#173e35] p-4 text-white shadow-2xl">
            <div className="flex items-center justify-between px-2 py-2"><p className="font-semibold">Maintenance of Everything</p><button onClick={() => setMobileMenu(false)}><X className="size-5" /></button></div>
            <Button onClick={newConversation} className="mt-5 bg-white text-[#173e35]"><Plus className="size-4" /> New chat</Button>
            <nav className="mt-5 space-y-1">{nav}</nav>
            <p className="mb-2 mt-8 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/50">Recent</p>
            {state.conversations.slice(0, 8).map((conversation) => <button key={conversation.id} onClick={() => { setActiveConversationId(conversation.id); chooseView("chat"); }} className="truncate rounded-lg px-2 py-2 text-left text-sm text-emerald-50/70">{conversation.title}</button>)}
          </aside>
        </div>
      )}
    </div>
  );
}
