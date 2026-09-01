import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
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

  it("records one linked canonical Event without overwriting the completed plan", () => {
    const db = new MoeDatabase(":memory:", false);
    const thing = db.createThing({ name: "Road bike" });
    const item = db.createMaintenance({
      thingId: thing.id,
      title: "Replace chain",
      timing: "this_month",
      rationale: "Chain checker reached replacement threshold.",
      data: { source: "Park Tool chain checker", details: { plannedPart: "11-speed chain" } },
    });

    db.updateMaintenance(item.id, {
      status: "done",
      occurredAt: "2026-08-29T12:00:00.000Z",
      completion: {
        summary: "Bike chain replaced",
        source: "Owner report",
        details: { mileage: "4,820 miles", installedPart: "Shimano HG601" },
      },
    });
    db.updateMaintenance(item.id, { status: "done", occurredAt: "2026-08-29T12:00:00.000Z" });

    expect(db.listMaintenance()).toEqual([]);
    expect(db.getHistory(thing.id)).toHaveLength(1);
    expect(db.getHistory(thing.id)[0]).toMatchObject({
      summary: "Bike chain replaced",
      data: {
        maintenanceItemId: item.id,
        source: "Owner report",
        details: { mileage: "4,820 miles", installedPart: "Shimano HG601" },
      },
    });
    expect(db.getMaintenance(item.id)).toMatchObject({
      rationale: "Chain checker reached replacement threshold.",
      data: { source: "Park Tool chain checker", details: { plannedPart: "11-speed chain" } },
    });
    db.close();
  });

  it("archives an obsolete intention without recording completion", () => {
    const db = new MoeDatabase(":memory:", false);
    const thing = db.createThing({ name: "Dyson V15 Detect" });
    const item = db.createMaintenance({
      thingId: thing.id,
      title: "Replace battery",
      timing: "later",
      rationale: "Speculative replacement reminder.",
    });

    const archived = db.updateMaintenance(item.id, { status: "archived" });

    expect(archived).toMatchObject({ id: item.id, status: "archived", completedAt: null });
    expect(db.listMaintenance({ thingId: thing.id })).toEqual([]);
    expect(db.getHistory(thing.id)).toEqual([]);
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

  it("adds identity-reconciliation fields to an existing database", () => {
    const directory = mkdtempSync(join(tmpdir(), "moe-database-migration-"));
    directories.push(directory);
    const path = join(directory, "moe.db");
    const legacy = new DatabaseSync(path);
    legacy.exec(`
      CREATE TABLE things (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        attributes_json TEXT NOT NULL DEFAULT '{}',
        care_preferences TEXT,
        created_at TEXT NOT NULL
      )
    `);
    legacy.close();

    const migrated = new MoeDatabase(path, false);
    const thing = migrated.createThing({ name: "Existing Thing" });
    expect(thing).toMatchObject({ archivedAt: null, mergedIntoId: null });
    migrated.close();
  });

  it("archives retired Things without deleting their history", () => {
    const db = new MoeDatabase(":memory:", false);
    const thing = db.createThing({ name: "Bosch dishwasher" });
    db.recordEvent({ thingId: thing.id, summary: "Drain pump replaced" });

    const archived = db.archiveThing(thing.id);

    expect(db.listThings()).toEqual([]);
    expect(db.listThings({ includeArchived: true })).toHaveLength(1);
    expect(archived?.archivedAt).not.toBeNull();
    expect(db.getHistory(thing.id)[0].summary).toBe("Drain pump replaced");
    db.close();
  });

  it("atomically merges attributed state into an agent-specified survivor", () => {
    const db = new MoeDatabase(":memory:", false);
    const generic = db.createThing({
      name: "Costco Dyson",
      attributes: { brand: "Dyson", retailer: "Costco" },
      carePreferences: "Group routine care.",
    });
    const specific = db.createThing({ name: "Dyson V12", attributes: { brand: "Dyson", model: "V12" } });
    db.recordEvent({ thingId: generic.id, summary: "Filter cleaned" });
    db.createMaintenance({ thingId: specific.id, title: "Clean brush bar" });

    const merged = db.mergeThings({
      keepId: specific.id,
      absorbId: generic.id,
      survivor: {
        name: "Dyson V12 Detect Slim",
        category: "Appliance",
        attributes: { brand: "Dyson", model: "V12 Detect Slim", retailer: "Costco" },
        carePreferences: "Group routine care.",
      },
    });

    expect(db.listThings()).toEqual([merged.thing]);
    expect(merged).toMatchObject({ eventsMoved: 1, maintenanceMoved: 0 });
    expect(merged.thing.attributes).toEqual({ brand: "Dyson", model: "V12 Detect Slim", retailer: "Costco" });
    expect(merged.absorbedThing).toMatchObject({ archivedAt: expect.any(String), mergedIntoId: specific.id });
    expect(db.getHistory(specific.id)).toHaveLength(1);
    expect(db.listMaintenance({ thingId: specific.id })).toHaveLength(1);
    db.close();
  });

  it("reassigns history and maintenance when one Thing becomes two", () => {
    const db = new MoeDatabase(":memory:", false);
    const original = db.createThing({ name: "Downstairs Dyson" });
    const upstairs = db.createThing({ name: "Upstairs Dyson" });
    const event = db.recordEvent({ thingId: original.id, summary: "Filter cleaned" });
    const maintenance = db.createMaintenance({ thingId: original.id, title: "Wash filter" });

    db.updateEvent(event.id, { thingId: upstairs.id });
    db.updateMaintenance(maintenance.id, { thingId: upstairs.id });

    expect(db.getHistory(upstairs.id)).toHaveLength(1);
    expect(db.listMaintenance({ thingId: upstairs.id })).toHaveLength(1);
    expect(db.getHistory(original.id)).toEqual([]);
    db.close();
  });
});
