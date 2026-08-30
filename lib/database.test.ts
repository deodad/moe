import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { MoeDatabase } from "@/lib/database";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("MoeDatabase", () => {
  it("seeds a believable local world", () => {
    const db = new MoeDatabase(":memory:");
    expect(db.listThings().map((thing) => thing.name).sort()).toEqual([
      "4Runner",
      "Bosch dishwasher",
      "Espresso machine",
      "HVAC",
      "House",
    ]);
    expect(db.listMaintenance().map((item) => item.title)).toContain("5,000-mile service");
    db.close();
  });

  it("records one history event when maintenance is completed", () => {
    const db = new MoeDatabase(":memory:", false);
    const thing = db.createThing({ name: "Road bike" });
    const item = db.createMaintenance({ thingId: thing.id, title: "Replace chain", timing: "this_month" });

    db.updateMaintenance(item.id, { status: "done", occurredAt: "2026-08-29T12:00:00.000Z" });
    db.updateMaintenance(item.id, { status: "done", occurredAt: "2026-08-29T12:00:00.000Z" });

    expect(db.listMaintenance()).toEqual([]);
    expect(db.getHistory(thing.id)).toHaveLength(1);
    expect(db.getHistory(thing.id)[0].summary).toBe("Replace chain completed");
    db.close();
  });

  it("persists Things, Events, MaintenanceItems, and Conversations after restart", () => {
    const directory = mkdtempSync(join(tmpdir(), "moe-database-"));
    directories.push(directory);
    const path = join(directory, "moe.db");
    const first = new MoeDatabase(path, false);
    const thing = first.createThing({ name: "2026 4Runner", carePreferences: "Keep forever." });
    first.recordEvent({ thingId: thing.id, summary: "Purchased" });
    first.createMaintenance({ thingId: thing.id, title: "5,000-mile service", timing: "later" });
    const conversation = first.createConversation("New 4Runner");
    first.saveConversation(conversation.id, {
      messages: [{ id: "message-1", role: "user", text: "I just bought it", createdAt: "2026-08-29T12:00:00.000Z" }],
      snapshot: { version: 1, history: [] },
    });
    first.close();

    const reopened = new MoeDatabase(path, false);
    expect(reopened.searchThings("2026")[0].carePreferences).toBe("Keep forever.");
    expect(reopened.getHistory(thing.id)[0].summary).toBe("Purchased");
    expect(reopened.listMaintenance({ thingId: thing.id })[0].title).toBe("5,000-mile service");
    expect(reopened.getConversation(conversation.id)?.messages[0].text).toBe("I just bought it");
    expect(reopened.getConversationSnapshot(conversation.id)).toEqual({ version: 1, history: [] });
    reopened.close();
  });
});
