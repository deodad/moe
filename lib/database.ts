import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type {
  AppState,
  ChatMessage,
  Conversation,
  HistoryEvent,
  MaintenanceItem,
  MaintenanceStatus,
  Thing,
  Timing,
} from "@/lib/types";

type JsonObject = Record<string, unknown>;

function now() {
  return new Date().toISOString();
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function stringify(value: unknown) {
  return JSON.stringify(value ?? {});
}

export class MoeDatabase {
  readonly sqlite: DatabaseSync;

  constructor(path = ":memory:", seed = true) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.sqlite = new DatabaseSync(path);
    this.sqlite.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    this.migrate();
    if (seed) this.seed();
  }

  close() {
    this.sqlite.close();
  }

  private migrate() {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS things (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        attributes_json TEXT NOT NULL DEFAULT '{}',
        care_preferences TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        thing_id TEXT REFERENCES things(id) ON DELETE SET NULL,
        summary TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        data_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS maintenance_items (
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
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        messages_json TEXT NOT NULL DEFAULT '[]',
        snapshot_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  private seed() {
    const row = this.sqlite.prepare("SELECT COUNT(*) AS count FROM things").get() as { count: number };
    if (row.count > 0) return;

    const house = this.createThing({ name: "House", category: "Home", attributes: { built: "1987" } });
    const runner = this.createThing({
      name: "4Runner",
      category: "Vehicle",
      attributes: { year: "2019", make: "Toyota", model: "4Runner", mileage: "64,180" },
      carePreferences: "Keep long term. Proactive about worthwhile reliability maintenance. Usually serviced at a shop.",
    });
    this.createThing({ name: "HVAC", category: "Home system", attributes: { serves: "House" } });
    this.createThing({ name: "Bosch dishwasher", category: "Appliance", attributes: { location: "Kitchen" } });
    this.createThing({ name: "Espresso machine", category: "Appliance", attributes: { brand: "Rocket" } });

    this.recordEvent({ thingId: runner.id, summary: "Oil changed", occurredAt: "2026-06-03T12:00:00.000Z" });
    this.recordEvent({ thingId: house.id, summary: "Replaced HVAC filter", occurredAt: "2026-07-14T12:00:00.000Z" });
    this.createMaintenance({
      thingId: runner.id,
      title: "5,000-mile service",
      timing: "this_month",
      rationale: "The odometer is approaching the next 5,000-mile service interval.",
    });
    this.createMaintenance({
      thingId: house.id,
      title: "Clean dryer vent",
      timing: "this_week",
      rationale: "Annual cleaning reduces drying time and lint buildup.",
    });
  }

  listThings(): Thing[] {
    const rows = this.sqlite.prepare("SELECT * FROM things ORDER BY created_at, name").all();
    return rows.map((row) => this.mapThing(row as Record<string, unknown>));
  }

  searchThings(query: string): Thing[] {
    const term = `%${query.trim()}%`;
    const rows = this.sqlite
      .prepare("SELECT * FROM things WHERE name LIKE ? OR category LIKE ? OR attributes_json LIKE ? ORDER BY name")
      .all(term, term, term);
    return rows.map((row) => this.mapThing(row as Record<string, unknown>));
  }

  getThing(id: string): Thing | null {
    const row = this.sqlite.prepare("SELECT * FROM things WHERE id = ?").get(id);
    return row ? this.mapThing(row as Record<string, unknown>) : null;
  }

  createThing(input: {
    name: string;
    category?: string | null;
    attributes?: Record<string, string>;
    carePreferences?: string | null;
  }): Thing {
    const id = randomUUID();
    const createdAt = now();
    this.sqlite
      .prepare("INSERT INTO things (id, name, category, attributes_json, care_preferences, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, input.name.trim(), input.category ?? null, stringify(input.attributes ?? {}), input.carePreferences ?? null, createdAt);
    return this.getThing(id)!;
  }

  updateThing(id: string, input: {
    name?: string;
    category?: string | null;
    attributes?: Record<string, string>;
    carePreferences?: string | null;
  }): Thing | null {
    const current = this.getThing(id);
    if (!current) return null;
    const attributes = input.attributes ? { ...current.attributes, ...input.attributes } : current.attributes;
    this.sqlite
      .prepare("UPDATE things SET name = ?, category = ?, attributes_json = ?, care_preferences = ? WHERE id = ?")
      .run(
        input.name?.trim() ?? current.name,
        input.category === undefined ? current.category : input.category,
        stringify(attributes),
        input.carePreferences === undefined ? current.carePreferences : input.carePreferences,
        id,
      );
    return this.getThing(id);
  }

  getHistory(thingId?: string | null): HistoryEvent[] {
    const rows = thingId
      ? this.sqlite.prepare("SELECT * FROM events WHERE thing_id = ? ORDER BY occurred_at DESC").all(thingId)
      : this.sqlite.prepare("SELECT * FROM events ORDER BY occurred_at DESC").all();
    return rows.map((row) => this.mapEvent(row as Record<string, unknown>));
  }

  recordEvent(input: { thingId?: string | null; summary: string; occurredAt?: string; data?: JsonObject }): HistoryEvent {
    const id = randomUUID();
    const createdAt = now();
    this.sqlite
      .prepare("INSERT INTO events (id, thing_id, summary, occurred_at, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, input.thingId ?? null, input.summary.trim(), input.occurredAt ?? createdAt, stringify(input.data ?? {}), createdAt);
    const row = this.sqlite.prepare("SELECT * FROM events WHERE id = ?").get(id)!;
    return this.mapEvent(row as Record<string, unknown>);
  }

  listMaintenance(options: { includeDone?: boolean; thingId?: string } = {}): MaintenanceItem[] {
    const clauses: string[] = [];
    const values: string[] = [];
    if (!options.includeDone) clauses.push("m.status = 'active'");
    if (options.thingId) {
      clauses.push("m.thing_id = ?");
      values.push(options.thingId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.sqlite.prepare(`
      SELECT m.*, t.name AS thing_name FROM maintenance_items m
      LEFT JOIN things t ON t.id = m.thing_id
      ${where}
      ORDER BY CASE timing WHEN 'overdue' THEN 0 WHEN 'this_week' THEN 1 WHEN 'this_month' THEN 2 ELSE 3 END,
               m.created_at
    `).all(...values);
    return rows.map((row) => this.mapMaintenance(row as Record<string, unknown>));
  }

  getMaintenance(id: string): MaintenanceItem | null {
    const row = this.sqlite.prepare(`
      SELECT m.*, t.name AS thing_name FROM maintenance_items m
      LEFT JOIN things t ON t.id = m.thing_id WHERE m.id = ?
    `).get(id);
    return row ? this.mapMaintenance(row as Record<string, unknown>) : null;
  }

  createMaintenance(input: {
    thingId?: string | null;
    title: string;
    timing?: Timing;
    rationale?: string | null;
    data?: JsonObject;
  }): MaintenanceItem {
    const id = randomUUID();
    const createdAt = now();
    this.sqlite.prepare(`
      INSERT INTO maintenance_items
        (id, thing_id, title, status, timing, rationale, data_json, completed_at, created_at, updated_at)
      VALUES (?, ?, ?, 'active', ?, ?, ?, NULL, ?, ?)
    `).run(id, input.thingId ?? null, input.title.trim(), input.timing ?? "later", input.rationale ?? null, stringify(input.data ?? {}), createdAt, createdAt);
    return this.getMaintenance(id)!;
  }

  updateMaintenance(id: string, input: {
    title?: string;
    status?: MaintenanceStatus;
    timing?: Timing;
    rationale?: string | null;
    data?: JsonObject;
    occurredAt?: string;
  }): MaintenanceItem | null {
    const current = this.getMaintenance(id);
    if (!current) return null;
    const completedAt = input.status === "done" ? input.occurredAt ?? now() : input.status === "active" ? null : current.completedAt;
    const nextData = input.data ? { ...current.data, ...input.data } : current.data;
    this.sqlite.exec("BEGIN");
    try {
      this.sqlite.prepare(`
        UPDATE maintenance_items SET title = ?, status = ?, timing = ?, rationale = ?, data_json = ?, completed_at = ?, updated_at = ?
        WHERE id = ?
      `).run(
        input.title?.trim() ?? current.title,
        input.status ?? current.status,
        input.timing ?? current.timing,
        input.rationale === undefined ? current.rationale : input.rationale,
        stringify(nextData),
        completedAt,
        now(),
        id,
      );
      if (input.status === "done" && current.status !== "done") {
        this.recordEvent({ thingId: current.thingId, summary: `${current.title} completed`, occurredAt: completedAt ?? undefined });
      }
      this.sqlite.exec("COMMIT");
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
    return this.getMaintenance(id);
  }

  listConversations(): Conversation[] {
    const rows = this.sqlite.prepare("SELECT * FROM conversations ORDER BY updated_at DESC").all();
    return rows.map((row) => this.mapConversation(row as Record<string, unknown>));
  }

  getConversation(id: string): Conversation | null {
    const row = this.sqlite.prepare("SELECT * FROM conversations WHERE id = ?").get(id);
    return row ? this.mapConversation(row as Record<string, unknown>) : null;
  }

  createConversation(title = "New conversation"): Conversation {
    const id = randomUUID();
    const createdAt = now();
    this.sqlite.prepare(`
      INSERT INTO conversations (id, title, messages_json, snapshot_json, created_at, updated_at)
      VALUES (?, ?, '[]', NULL, ?, ?)
    `).run(id, title, createdAt, createdAt);
    return this.getConversation(id)!;
  }

  saveConversation(id: string, input: { title?: string; messages: ChatMessage[]; snapshot?: unknown }): Conversation {
    const current = this.getConversation(id);
    if (!current) throw new Error("Conversation not found");
    this.sqlite.prepare(`
      UPDATE conversations SET title = ?, messages_json = ?, snapshot_json = COALESCE(?, snapshot_json), updated_at = ? WHERE id = ?
    `).run(input.title ?? current.title, stringify(input.messages), input.snapshot ? stringify(input.snapshot) : null, now(), id);
    return this.getConversation(id)!;
  }

  getConversationSnapshot(id: string): unknown | null {
    const row = this.sqlite.prepare("SELECT snapshot_json FROM conversations WHERE id = ?").get(id) as { snapshot_json: string | null } | undefined;
    return row?.snapshot_json ? parseJson<unknown>(row.snapshot_json, null) : null;
  }

  getState(): AppState {
    return {
      things: this.listThings(),
      events: this.getHistory(),
      maintenance: this.listMaintenance(),
      conversations: this.listConversations(),
    };
  }

  private mapThing(row: Record<string, unknown>): Thing {
    return {
      id: String(row.id),
      name: String(row.name),
      category: row.category ? String(row.category) : null,
      attributes: parseJson<Record<string, string>>(row.attributes_json, {}),
      carePreferences: row.care_preferences ? String(row.care_preferences) : null,
      createdAt: String(row.created_at),
    };
  }

  private mapEvent(row: Record<string, unknown>): HistoryEvent {
    return {
      id: String(row.id),
      thingId: row.thing_id ? String(row.thing_id) : null,
      summary: String(row.summary),
      occurredAt: String(row.occurred_at),
      data: parseJson<JsonObject>(row.data_json, {}),
      createdAt: String(row.created_at),
    };
  }

  private mapMaintenance(row: Record<string, unknown>): MaintenanceItem {
    return {
      id: String(row.id),
      thingId: row.thing_id ? String(row.thing_id) : null,
      thingName: row.thing_name ? String(row.thing_name) : null,
      title: String(row.title),
      status: String(row.status) as MaintenanceStatus,
      timing: String(row.timing) as Timing,
      rationale: row.rationale ? String(row.rationale) : null,
      data: parseJson<JsonObject>(row.data_json, {}),
      completedAt: row.completed_at ? String(row.completed_at) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapConversation(row: Record<string, unknown>): Conversation {
    return {
      id: String(row.id),
      title: String(row.title),
      messages: parseJson<ChatMessage[]>(row.messages_json, []),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }
}

const globalForDatabase = globalThis as typeof globalThis & { moeDatabase?: MoeDatabase };

export function getDatabase() {
  if (!globalForDatabase.moeDatabase) {
    const path = process.env.MOE_DATABASE_PATH ?? join(process.cwd(), "data", "moe.db");
    globalForDatabase.moeDatabase = new MoeDatabase(path);
  }
  return globalForDatabase.moeDatabase;
}
