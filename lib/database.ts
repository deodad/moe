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
  Subject,
  Timing,
} from "@/lib/types";
import { legacyTimingDate, timingForMaintenance } from "@/lib/maintenance-schedule";

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

function normalizeDue(due: { date?: string; condition?: string }, checkOn?: string | null) {
  const normalized = {
    ...(due.date ? { date: due.date } : {}),
    ...(due.condition?.trim() ? { condition: due.condition.trim() } : {}),
  };
  if (!normalized.date && !normalized.condition) throw new Error("Maintenance due criteria require a date or condition");
  if (normalized.date) timingForMaintenance({ date: normalized.date }, null);
  if (checkOn) timingForMaintenance({}, checkOn);
  return normalized;
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
    const existingTables = new Set(
      (this.sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map(
        (table) => table.name,
      ),
    );
    if (existingTables.has("things") && !existingTables.has("subjects")) {
      this.sqlite.exec(`
        ALTER TABLE things RENAME TO subjects;
        ALTER TABLE events RENAME COLUMN thing_id TO subject_id;
        ALTER TABLE maintenance_items RENAME COLUMN thing_id TO subject_id;
      `);
    }

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        attributes_json TEXT NOT NULL DEFAULT '{}',
        care_preferences TEXT,
        archived_at TEXT,
        merged_into_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
        summary TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        data_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS maintenance_items (
        id TEXT PRIMARY KEY,
        subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        due_json TEXT NOT NULL DEFAULT '{}',
        check_on TEXT,
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
    const subjectColumns = new Set(
      (this.sqlite.prepare("PRAGMA table_info(subjects)").all() as Array<{ name: string }>).map((column) => column.name),
    );
    if (!subjectColumns.has("archived_at")) this.sqlite.exec("ALTER TABLE subjects ADD COLUMN archived_at TEXT");
    if (!subjectColumns.has("merged_into_id")) {
      this.sqlite.exec("ALTER TABLE subjects ADD COLUMN merged_into_id TEXT REFERENCES subjects(id) ON DELETE SET NULL");
    }
    const maintenanceColumns = new Set(
      (this.sqlite.prepare("PRAGMA table_info(maintenance_items)").all() as Array<{ name: string }>).map((column) => column.name),
    );
    if (!maintenanceColumns.has("due_json")) this.sqlite.exec("ALTER TABLE maintenance_items ADD COLUMN due_json TEXT NOT NULL DEFAULT '{}'");
    if (!maintenanceColumns.has("check_on")) this.sqlite.exec("ALTER TABLE maintenance_items ADD COLUMN check_on TEXT");
    if (maintenanceColumns.has("due_date")) {
      this.sqlite.exec("UPDATE maintenance_items SET due_json = json_object('date', due_date) WHERE due_date IS NOT NULL");
      this.sqlite.exec("ALTER TABLE maintenance_items DROP COLUMN due_date");
    }
    if (maintenanceColumns.has("timing")) {
      const legacyItems = this.sqlite.prepare("SELECT id, timing, due_json FROM maintenance_items").all() as Array<{ id: string; timing: Timing; due_json: string }>;
      const backfill = this.sqlite.prepare("UPDATE maintenance_items SET due_json = ? WHERE id = ?");
      for (const item of legacyItems) {
        if (item.due_json === "{}") backfill.run(stringify({ date: legacyTimingDate(item.timing) }), item.id);
      }
      this.sqlite.exec("ALTER TABLE maintenance_items DROP COLUMN timing");
    }
  }

  private seed() {
    const row = this.sqlite.prepare("SELECT COUNT(*) AS count FROM subjects").get() as { count: number };
    if (row.count > 0) return;

    const house = this.createSubject({ name: "House", category: "Home", attributes: { built: "1987" } });
    const runner = this.createSubject({
      name: "4Runner",
      category: "Vehicle",
      attributes: { year: "2019", make: "Toyota", model: "4Runner" },
      carePreferences: "Keep long term. Proactive about worthwhile reliability maintenance. Usually serviced at a shop.",
    });
    this.createSubject({ name: "HVAC", category: "Home system", attributes: { serves: "House" } });
    this.createSubject({ name: "Bosch dishwasher", category: "Appliance", attributes: { location: "Kitchen" } });
    this.createSubject({ name: "Espresso machine", category: "Appliance", attributes: { brand: "Rocket" } });

    this.recordEvent({ subjectId: runner.id, summary: "Oil changed", occurredAt: "2026-06-03T12:00:00.000Z" });
    this.recordEvent({
      subjectId: runner.id,
      summary: "Odometer recorded at 64,180 miles",
      occurredAt: "2026-08-29T12:00:00.000Z",
      data: { details: { odometer: "64,180 miles" } },
    });
    this.recordEvent({ subjectId: house.id, summary: "Replaced HVAC filter", occurredAt: "2026-07-14T12:00:00.000Z" });
    this.createMaintenance({
      subjectId: runner.id,
      title: "5,000-mile service",
      due: { condition: "At the next 5,000-mile service interval" },
      checkOn: "2026-09-21",
      rationale: "The odometer is approaching the next 5,000-mile service interval.",
    });
    this.createMaintenance({
      subjectId: house.id,
      title: "Clean dryer vent",
      due: { date: "2026-09-04" },
      rationale: "Annual cleaning reduces drying time and lint buildup.",
    });
  }

  listSubjects(options: { includeArchived?: boolean } = {}): Subject[] {
    const where = options.includeArchived ? "" : "WHERE archived_at IS NULL";
    const rows = this.sqlite.prepare(`SELECT * FROM subjects ${where} ORDER BY created_at, name`).all();
    return rows.map((row) => this.mapSubject(row as Record<string, unknown>));
  }

  searchSubjects(query: string, options: { includeArchived?: boolean } = {}): Subject[] {
    const term = `%${query.trim()}%`;
    const archived = options.includeArchived ? "" : "archived_at IS NULL AND";
    const rows = this.sqlite
      .prepare(`SELECT * FROM subjects WHERE ${archived} (name LIKE ? OR category LIKE ? OR attributes_json LIKE ?) ORDER BY name`)
      .all(term, term, term);
    return rows.map((row) => this.mapSubject(row as Record<string, unknown>));
  }

  getSubject(id: string): Subject | null {
    const row = this.sqlite.prepare("SELECT * FROM subjects WHERE id = ?").get(id);
    return row ? this.mapSubject(row as Record<string, unknown>) : null;
  }

  createSubject(input: {
    name: string;
    category?: string | null;
    attributes?: Record<string, string>;
    carePreferences?: string | null;
  }): Subject {
    const id = randomUUID();
    const createdAt = now();
    this.sqlite
      .prepare("INSERT INTO subjects (id, name, category, attributes_json, care_preferences, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, input.name.trim(), input.category ?? null, stringify(input.attributes ?? {}), input.carePreferences ?? null, createdAt);
    return this.getSubject(id)!;
  }

  updateSubject(id: string, input: {
    name?: string;
    category?: string | null;
    attributes?: Record<string, string>;
    carePreferences?: string | null;
  }): Subject | null {
    const current = this.getSubject(id);
    if (!current) return null;
    const attributes = input.attributes ? { ...current.attributes, ...input.attributes } : current.attributes;
    this.sqlite
      .prepare("UPDATE subjects SET name = ?, category = ?, attributes_json = ?, care_preferences = ? WHERE id = ?")
      .run(
        input.name?.trim() ?? current.name,
        input.category === undefined ? current.category : input.category,
        stringify(attributes),
        input.carePreferences === undefined ? current.carePreferences : input.carePreferences,
        id,
      );
    return this.getSubject(id);
  }

  archiveSubject(id: string): Subject | null {
    const current = this.getSubject(id);
    if (!current) return null;
    if (!current.archivedAt) {
      this.sqlite.prepare("UPDATE subjects SET archived_at = ? WHERE id = ?").run(now(), id);
    }
    return this.getSubject(id);
  }

  mergeSubjects(input: {
    keepId: string;
    absorbId: string;
    survivor: {
      name: string;
      category: string | null;
      attributes: Record<string, string>;
      carePreferences: string | null;
    };
  }) {
    if (input.keepId === input.absorbId) throw new Error("Cannot merge a Subject into itself");
    const keep = this.getSubject(input.keepId);
    const absorb = this.getSubject(input.absorbId);
    if (!keep || !absorb) throw new Error("Subject not found");
    if (keep.archivedAt || absorb.archivedAt) throw new Error("Cannot merge an archived Subject");

    const eventsMoved = Number(
      (this.sqlite.prepare("SELECT COUNT(*) AS count FROM events WHERE subject_id = ?").get(input.absorbId) as { count: number }).count,
    );
    const maintenanceMoved = Number(
      (this.sqlite.prepare("SELECT COUNT(*) AS count FROM maintenance_items WHERE subject_id = ?").get(input.absorbId) as { count: number }).count,
    );
    const mergedAt = now();

    this.sqlite.exec("BEGIN");
    try {
      this.sqlite.prepare(`
        UPDATE subjects SET name = ?, category = ?, attributes_json = ?, care_preferences = ? WHERE id = ?
      `).run(
        input.survivor.name.trim(),
        input.survivor.category,
        stringify(input.survivor.attributes),
        input.survivor.carePreferences,
        input.keepId,
      );
      this.sqlite.prepare("UPDATE events SET subject_id = ? WHERE subject_id = ?").run(input.keepId, input.absorbId);
      this.sqlite.prepare("UPDATE maintenance_items SET subject_id = ?, updated_at = ? WHERE subject_id = ?")
        .run(input.keepId, mergedAt, input.absorbId);
      this.sqlite.prepare("UPDATE subjects SET archived_at = ?, merged_into_id = ? WHERE id = ?")
        .run(mergedAt, input.keepId, input.absorbId);
      this.sqlite.exec("COMMIT");
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }

    return {
      subject: this.getSubject(input.keepId)!,
      absorbedSubject: this.getSubject(input.absorbId)!,
      eventsMoved,
      maintenanceMoved,
    };
  }

  getHistory(subjectId?: string | null): HistoryEvent[] {
    const rows = subjectId
      ? this.sqlite.prepare("SELECT * FROM events WHERE subject_id = ? ORDER BY occurred_at DESC").all(subjectId)
      : this.sqlite.prepare("SELECT * FROM events ORDER BY occurred_at DESC").all();
    return rows.map((row) => this.mapEvent(row as Record<string, unknown>));
  }

  recordEvent(input: { subjectId?: string | null; summary: string; occurredAt?: string; data?: JsonObject }): HistoryEvent {
    const id = randomUUID();
    const createdAt = now();
    this.sqlite
      .prepare("INSERT INTO events (id, subject_id, summary, occurred_at, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, input.subjectId ?? null, input.summary.trim(), input.occurredAt ?? createdAt, stringify(input.data ?? {}), createdAt);
    const row = this.sqlite.prepare("SELECT * FROM events WHERE id = ?").get(id)!;
    return this.mapEvent(row as Record<string, unknown>);
  }

  getEvent(id: string): HistoryEvent | null {
    const row = this.sqlite.prepare("SELECT * FROM events WHERE id = ?").get(id);
    return row ? this.mapEvent(row as Record<string, unknown>) : null;
  }

  updateEvent(id: string, input: {
    subjectId?: string | null;
    summary?: string;
    occurredAt?: string;
    data?: JsonObject;
  }): HistoryEvent | null {
    const current = this.getEvent(id);
    if (!current) return null;
    this.sqlite.prepare(`
      UPDATE events SET subject_id = ?, summary = ?, occurred_at = ?, data_json = ? WHERE id = ?
    `).run(
      input.subjectId === undefined ? current.subjectId : input.subjectId,
      input.summary?.trim() ?? current.summary,
      input.occurredAt ?? current.occurredAt,
      stringify(input.data ? { ...current.data, ...input.data } : current.data),
      id,
    );
    return this.getEvent(id);
  }

  listMaintenance(options: { includeDone?: boolean; subjectId?: string } = {}): MaintenanceItem[] {
    const clauses: string[] = [];
    const values: string[] = [];
    if (!options.includeDone) clauses.push("m.status = 'active'");
    if (options.subjectId) {
      clauses.push("m.subject_id = ?");
      values.push(options.subjectId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.sqlite.prepare(`
      SELECT m.*, t.name AS subject_name FROM maintenance_items m
      LEFT JOIN subjects t ON t.id = m.subject_id
      ${where}
      ORDER BY
        CASE WHEN json_extract(m.due_json, '$.date') IS NULL AND m.check_on IS NULL THEN 1 ELSE 0 END,
        CASE
          WHEN json_extract(m.due_json, '$.date') IS NULL THEN m.check_on
          WHEN m.check_on IS NULL THEN json_extract(m.due_json, '$.date')
          WHEN json_extract(m.due_json, '$.date') <= m.check_on THEN json_extract(m.due_json, '$.date')
          ELSE m.check_on
        END,
        m.created_at
    `).all(...values);
    return rows.map((row) => this.mapMaintenance(row as Record<string, unknown>));
  }

  getMaintenance(id: string): MaintenanceItem | null {
    const row = this.sqlite.prepare(`
      SELECT m.*, t.name AS subject_name FROM maintenance_items m
      LEFT JOIN subjects t ON t.id = m.subject_id WHERE m.id = ?
    `).get(id);
    return row ? this.mapMaintenance(row as Record<string, unknown>) : null;
  }

  createMaintenance(input: {
    subjectId?: string | null;
    title: string;
    due?: { date?: string; condition?: string };
    checkOn?: string | null;
    dueDate?: string;
    /** @deprecated Compatibility for old fixtures; converted immediately to a concrete date. */
    timing?: Timing;
    rationale?: string | null;
    data?: JsonObject;
  }): MaintenanceItem {
    const id = randomUUID();
    const createdAt = now();
    const due = normalizeDue(input.due ?? { date: input.dueDate ?? legacyTimingDate(input.timing ?? "later") }, input.checkOn);
    this.sqlite.prepare(`
      INSERT INTO maintenance_items
        (id, subject_id, title, status, due_json, check_on, rationale, data_json, completed_at, created_at, updated_at)
      VALUES (?, ?, ?, 'active', ?, ?, ?, ?, NULL, ?, ?)
    `).run(id, input.subjectId ?? null, input.title.trim(), stringify(due), input.checkOn ?? null, input.rationale ?? null, stringify(input.data ?? {}), createdAt, createdAt);
    return this.getMaintenance(id)!;
  }

  updateMaintenance(id: string, input: {
    subjectId?: string | null;
    title?: string;
    status?: MaintenanceStatus;
    due?: { date?: string; condition?: string };
    checkOn?: string | null;
    dueDate?: string;
    /** @deprecated Compatibility for old fixtures; converted immediately to a concrete date. */
    timing?: Timing;
    rationale?: string | null;
    data?: JsonObject;
    occurredAt?: string;
    completion?: {
      summary?: string;
      source?: string | null;
      details?: JsonObject;
    };
  }): MaintenanceItem | null {
    const current = this.getMaintenance(id);
    if (!current) return null;
    const completedAt = input.status === "done" ? input.occurredAt ?? now() : input.status === "active" ? null : current.completedAt;
    const nextData = input.data ? { ...current.data, ...input.data } : current.data;
    const nextSubjectId = input.subjectId === undefined ? current.subjectId : input.subjectId;
    const nextTitle = input.title?.trim() ?? current.title;
    const due = normalizeDue(input.due ?? (input.dueDate || input.timing
      ? { ...current.due, date: input.dueDate ?? legacyTimingDate(input.timing!) }
      : current.due), input.checkOn === undefined ? current.checkOn : input.checkOn);
    this.sqlite.exec("BEGIN");
    try {
      this.sqlite.prepare(`
        UPDATE maintenance_items SET subject_id = ?, title = ?, status = ?, due_json = ?, check_on = ?, rationale = ?, data_json = ?, completed_at = ?, updated_at = ?
        WHERE id = ?
      `).run(
        nextSubjectId,
        nextTitle,
        input.status ?? current.status,
        stringify(due),
        input.checkOn === undefined ? current.checkOn : input.checkOn,
        input.rationale === undefined ? current.rationale : input.rationale,
        stringify(nextData),
        completedAt,
        now(),
        id,
      );
      if (input.status === "done" && current.status !== "done") {
        this.recordEvent({
          subjectId: nextSubjectId,
          summary: input.completion?.summary?.trim() || `${nextTitle} completed`,
          occurredAt: completedAt ?? undefined,
          data: {
            maintenanceItemId: id,
            ...(input.completion?.source === undefined ? {} : { source: input.completion.source }),
            ...(input.completion?.details === undefined ? {} : { details: input.completion.details }),
          },
        });
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
      subjects: this.listSubjects(),
      events: this.getHistory(),
      maintenance: this.listMaintenance(),
      conversations: this.listConversations(),
    };
  }

  private mapSubject(row: Record<string, unknown>): Subject {
    return {
      id: String(row.id),
      name: String(row.name),
      category: row.category ? String(row.category) : null,
      attributes: parseJson<Record<string, string>>(row.attributes_json, {}),
      carePreferences: row.care_preferences ? String(row.care_preferences) : null,
      archivedAt: row.archived_at ? String(row.archived_at) : null,
      mergedIntoId: row.merged_into_id ? String(row.merged_into_id) : null,
      createdAt: String(row.created_at),
    };
  }

  private mapEvent(row: Record<string, unknown>): HistoryEvent {
    return {
      id: String(row.id),
      subjectId: row.subject_id ? String(row.subject_id) : null,
      summary: String(row.summary),
      occurredAt: String(row.occurred_at),
      data: parseJson<JsonObject>(row.data_json, {}),
      createdAt: String(row.created_at),
    };
  }

  private mapMaintenance(row: Record<string, unknown>): MaintenanceItem {
    return {
      id: String(row.id),
      subjectId: row.subject_id ? String(row.subject_id) : null,
      subjectName: row.subject_name ? String(row.subject_name) : null,
      title: String(row.title),
      status: String(row.status) as MaintenanceStatus,
      due: parseJson<{ date?: string; condition?: string }>(row.due_json, {}),
      checkOn: row.check_on ? String(row.check_on) : null,
      timing: timingForMaintenance(parseJson<{ date?: string }>(row.due_json, {}), row.check_on ? String(row.check_on) : null),
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
