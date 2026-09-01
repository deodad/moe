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
    expect(db.listSubjects().map((subject) => subject.name).sort()).toEqual([
      "4Runner",
      "Bosch dishwasher",
      "Espresso machine",
      "HVAC",
      "House",
    ]);
    expect(db.listMaintenance().map((item) => item.title)).toContain("5,000-mile service");
    db.close();
  });

  it("stores honest due criteria and derives its attention bucket", () => {
    const db = new MoeDatabase(":memory:", false);
    const item = db.createMaintenance({
      title: "Winterize outdoor faucet",
      due: { condition: "Before the first freeze" },
      checkOn: "2026-10-15",
    });

    expect(item).toMatchObject({
      due: { condition: "Before the first freeze" },
      checkOn: "2026-10-15",
    });
    expect(db.sqlite.prepare("SELECT due_json, check_on FROM maintenance_items WHERE id = ?").get(item.id)).toEqual({
      due_json: JSON.stringify({ condition: "Before the first freeze" }),
      check_on: "2026-10-15",
    });
    expect((db.sqlite.prepare("PRAGMA table_info(maintenance_items)").all() as Array<{ name: string }>).map(({ name }) => name)).not.toContain("timing");
    expect((db.sqlite.prepare("PRAGMA table_info(maintenance_items)").all() as Array<{ name: string }>).map(({ name }) => name)).not.toContain("due_date");
    db.close();
  });

  it("records one linked canonical Event without overwriting the completed plan", () => {
    const db = new MoeDatabase(":memory:", false);
    const subject = db.createSubject({ name: "Road bike" });
    const item = db.createMaintenance({
      subjectId: subject.id,
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
    expect(db.getHistory(subject.id)).toHaveLength(1);
    expect(db.getHistory(subject.id)[0]).toMatchObject({
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
    const subject = db.createSubject({ name: "Dyson V15 Detect" });
    const item = db.createMaintenance({
      subjectId: subject.id,
      title: "Replace battery",
      timing: "later",
      rationale: "Speculative replacement reminder.",
    });

    const archived = db.updateMaintenance(item.id, { status: "archived" });

    expect(archived).toMatchObject({ id: item.id, status: "archived", completedAt: null });
    expect(db.listMaintenance({ subjectId: subject.id })).toEqual([]);
    expect(db.getHistory(subject.id)).toEqual([]);
    db.close();
  });

  it("persists Subjects, Events, MaintenanceItems, and Conversations after restart", () => {
    const directory = mkdtempSync(join(tmpdir(), "moe-database-"));
    directories.push(directory);
    const path = join(directory, "moe.db");
    const first = new MoeDatabase(path, false);
    const subject = first.createSubject({ name: "2026 4Runner", carePreferences: "Keep forever." });
    first.recordEvent({ subjectId: subject.id, summary: "Purchased" });
    first.createMaintenance({ subjectId: subject.id, title: "5,000-mile service", timing: "later" });
    const conversation = first.createConversation("New 4Runner");
    first.saveConversation(conversation.id, {
      messages: [{ id: "message-1", role: "user", text: "I just bought it", createdAt: "2026-08-29T12:00:00.000Z" }],
      snapshot: { version: 1, history: [] },
    });
    first.close();

    const reopened = new MoeDatabase(path, false);
    expect(reopened.searchSubjects("2026")[0].carePreferences).toBe("Keep forever.");
    expect(reopened.getHistory(subject.id)[0].summary).toBe("Purchased");
    expect(reopened.listMaintenance({ subjectId: subject.id })[0].title).toBe("5,000-mile service");
    expect(reopened.getConversation(conversation.id)?.messages[0].text).toBe("I just bought it");
    expect(reopened.getConversationSnapshot(conversation.id)).toEqual({ version: 1, history: [] });
    reopened.close();
  });

  it("renames legacy Thing storage without losing attributed state", () => {
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
      );
      CREATE TABLE events (
        id TEXT PRIMARY KEY,
        thing_id TEXT REFERENCES things(id) ON DELETE SET NULL,
        summary TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        data_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE TABLE maintenance_items (
        id TEXT PRIMARY KEY,
        thing_id TEXT REFERENCES things(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        timing TEXT NOT NULL DEFAULT 'later',
        rationale TEXT,
        data_json TEXT NOT NULL DEFAULT '{}',
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO things VALUES ('legacy-subject', 'Existing Thing', 'Appliance', '{}', 'Keep it running.', '2026-01-01');
      INSERT INTO events VALUES ('legacy-event', 'legacy-subject', 'Filter cleaned', '2026-02-01', '{}', '2026-02-01');
      INSERT INTO maintenance_items VALUES ('legacy-maintenance', 'legacy-subject', 'Wash filter', 'active', 'later', NULL, '{}', NULL, '2026-02-01', '2026-02-01');
    `);
    legacy.close();

    const migrated = new MoeDatabase(path, false);
    expect(migrated.getSubject("legacy-subject")).toMatchObject({
      name: "Existing Thing",
      carePreferences: "Keep it running.",
      archivedAt: null,
      mergedIntoId: null,
    });
    expect(migrated.getHistory("legacy-subject")[0].summary).toBe("Filter cleaned");
    expect(migrated.getMaintenance("legacy-maintenance")).toMatchObject({
      subjectId: "legacy-subject",
      title: "Wash filter",
      due: { date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
    });
    migrated.close();
  });

  it("migrates date-only maintenance into due criteria", () => {
    const directory = mkdtempSync(join(tmpdir(), "moe-due-migration-"));
    directories.push(directory);
    const path = join(directory, "moe.db");
    const previous = new DatabaseSync(path);
    previous.exec(`
      CREATE TABLE subjects (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT, attributes_json TEXT NOT NULL DEFAULT '{}',
        care_preferences TEXT, archived_at TEXT, merged_into_id TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE events (
        id TEXT PRIMARY KEY, subject_id TEXT, summary TEXT NOT NULL, occurred_at TEXT NOT NULL,
        data_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
      );
      CREATE TABLE maintenance_items (
        id TEXT PRIMARY KEY, subject_id TEXT, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
        due_date TEXT NOT NULL, rationale TEXT, data_json TEXT NOT NULL DEFAULT '{}', completed_at TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, messages_json TEXT NOT NULL DEFAULT '[]', snapshot_json TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO maintenance_items VALUES ('dated-item', NULL, 'Clean dryer vent', 'active', '2026-10-15', NULL, '{}', NULL, '2026-09-01', '2026-09-01');
    `);
    previous.close();

    const migrated = new MoeDatabase(path, false);
    expect(migrated.getMaintenance("dated-item")).toMatchObject({
      due: { date: "2026-10-15" },
      checkOn: null,
    });
    expect((migrated.sqlite.prepare("PRAGMA table_info(maintenance_items)").all() as Array<{ name: string }>).map(({ name }) => name)).not.toContain("due_date");
    migrated.close();
  });

  it("archives retired Subjects without deleting their history", () => {
    const db = new MoeDatabase(":memory:", false);
    const subject = db.createSubject({ name: "Bosch dishwasher" });
    db.recordEvent({ subjectId: subject.id, summary: "Drain pump replaced" });

    const archived = db.archiveSubject(subject.id);

    expect(db.listSubjects()).toEqual([]);
    expect(db.listSubjects({ includeArchived: true })).toHaveLength(1);
    expect(archived?.archivedAt).not.toBeNull();
    expect(db.getHistory(subject.id)[0].summary).toBe("Drain pump replaced");
    db.close();
  });

  it("atomically merges attributed state into an agent-specified survivor", () => {
    const db = new MoeDatabase(":memory:", false);
    const generic = db.createSubject({
      name: "Costco Dyson",
      attributes: { brand: "Dyson", retailer: "Costco" },
      carePreferences: "Group routine care.",
    });
    const specific = db.createSubject({ name: "Dyson V12", attributes: { brand: "Dyson", model: "V12" } });
    db.recordEvent({ subjectId: generic.id, summary: "Filter cleaned" });
    db.createMaintenance({ subjectId: specific.id, title: "Clean brush bar" });

    const merged = db.mergeSubjects({
      keepId: specific.id,
      absorbId: generic.id,
      survivor: {
        name: "Dyson V12 Detect Slim",
        category: "Appliance",
        attributes: { brand: "Dyson", model: "V12 Detect Slim", retailer: "Costco" },
        carePreferences: "Group routine care.",
      },
    });

    expect(db.listSubjects()).toEqual([merged.subject]);
    expect(merged).toMatchObject({ eventsMoved: 1, maintenanceMoved: 0 });
    expect(merged.subject.attributes).toEqual({ brand: "Dyson", model: "V12 Detect Slim", retailer: "Costco" });
    expect(merged.absorbedSubject).toMatchObject({ archivedAt: expect.any(String), mergedIntoId: specific.id });
    expect(db.getHistory(specific.id)).toHaveLength(1);
    expect(db.listMaintenance({ subjectId: specific.id })).toHaveLength(1);
    db.close();
  });

  it("reassigns history and maintenance when one Subject becomes two", () => {
    const db = new MoeDatabase(":memory:", false);
    const original = db.createSubject({ name: "Downstairs Dyson" });
    const upstairs = db.createSubject({ name: "Upstairs Dyson" });
    const event = db.recordEvent({ subjectId: original.id, summary: "Filter cleaned" });
    const maintenance = db.createMaintenance({ subjectId: original.id, title: "Wash filter" });

    db.updateEvent(event.id, { subjectId: upstairs.id });
    db.updateMaintenance(maintenance.id, { subjectId: upstairs.id });

    expect(db.getHistory(upstairs.id)).toHaveLength(1);
    expect(db.listMaintenance({ subjectId: upstairs.id })).toHaveLength(1);
    expect(db.getHistory(original.id)).toEqual([]);
    db.close();
  });
});
