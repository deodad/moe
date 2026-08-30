import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { MoeDatabase } from "@/lib/database";
import { createApplicationTools } from "@/agent/tools";

const temporaryDirectories: string[] = [];

function databasePath() {
  const directory = mkdtempSync(join(tmpdir(), "moe-test-"));
  temporaryDirectories.push(directory);
  return join(directory, "moe.db");
}

afterEach(() => {
  while (temporaryDirectories.length) rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
});

describe("persistent product state", () => {
  it("preserves Things, care preferences, maintenance, history, and conversations after restart", () => {
    const path = databasePath();
    const first = new MoeDatabase(path, false);
    const thing = first.createThing({
      name: "4Runner",
      category: "Vehicle",
      attributes: { year: "2026" },
      carePreferences: "Keep it forever.",
    });
    const maintenance = first.createMaintenance({
      thingId: thing.id,
      title: "5,000-mile service",
      timing: "this_month",
    });
    first.updateMaintenance(maintenance.id, { status: "done", occurredAt: "2026-08-29T12:00:00.000Z" });
    const conversation = first.createConversation("New 4Runner");
    first.saveConversation(conversation.id, {
      messages: [{ id: "message-1", role: "user", text: "I want to keep it forever.", createdAt: "2026-08-29T12:00:00.000Z" }],
      snapshot: { version: 1, history: [] },
    });
    first.close();

    const resumed = new MoeDatabase(path, false);
    expect(resumed.getThing(thing.id)?.carePreferences).toBe("Keep it forever.");
    expect(resumed.getMaintenance(maintenance.id)?.status).toBe("done");
    expect(resumed.getHistory(thing.id).map((event) => event.summary)).toContain("5,000-mile service completed");
    expect(resumed.getConversation(conversation.id)?.messages[0]?.text).toBe("I want to keep it forever.");
    expect(resumed.getConversationSnapshot(conversation.id)).toEqual({ version: 1, history: [] });
    resumed.close();
  });

  it("runs the Milestone 2 state changes through the agent's application tools", async () => {
    const db = new MoeDatabase(":memory:", false);
    const tools = createApplicationTools(db);
    const context = { callId: "call", parentCallId: "", sessionId: "session" };

    expect(await tools.search_things.handler({ query: "4Runner" }, context)).toEqual([]);
    const thing = await tools.create_thing.handler({
      name: "4Runner",
      category: "Vehicle",
      attributes: { year: "2026", make: "Toyota" },
      care_preferences: "Keep it forever. Proactive about worthwhile reliability maintenance.",
    }, context) as { id: string };
    await tools.update_thing.handler({
      id: thing.id,
      care_preferences: "Keep it forever. Toyota handles scheduled service; track service intervals.",
    }, context);
    const item = await tools.create_maintenance.handler({
      thing_id: thing.id,
      title: "5,000-mile service",
      timing: "this_month",
      rationale: "First Toyota service interval.",
    }, context) as { id: string };
    await tools.update_maintenance.handler({
      id: item.id,
      status: "done",
      occurred_at: "2026-08-29T12:00:00.000Z",
    }, context);
    await tools.create_maintenance.handler({
      thing_id: thing.id,
      title: "10,000-mile service",
      timing: "later",
      rationale: "Next shop service interval.",
    }, context);

    expect(db.getThing(thing.id)?.carePreferences).toContain("Toyota handles scheduled service");
    expect(db.getMaintenance(item.id)?.status).toBe("done");
    expect(db.getHistory(thing.id)[0]?.summary).toBe("5,000-mile service completed");
    expect(db.listMaintenance({ thingId: thing.id }).map((entry) => entry.title)).toEqual(["10,000-mile service"]);
    db.close();
  });

  it("uses the same completion behavior for structured UI mutations", () => {
    const db = new MoeDatabase(":memory:", false);
    const thing = db.createThing({ name: "Espresso machine" });
    const item = db.createMaintenance({ thingId: thing.id, title: "Backflush", timing: "this_week" });

    db.updateMaintenance(item.id, { status: "done" });

    expect(db.getMaintenance(item.id)?.status).toBe("done");
    expect(db.getHistory(thing.id)[0]?.summary).toBe("Backflush completed");
    db.close();
  });
});
