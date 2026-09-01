import type { ToolMap } from "nanocodex";
import type { MoeDatabase } from "@/lib/database";
import type { MaintenanceStatus } from "@/lib/types";

type Input = Record<string, unknown>;

function object(input: unknown): Input {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected an object");
  return input as Input;
}

function string(input: Input, key: string, required = true): string | undefined {
  const value = input[key];
  if (value == null && !required) return undefined;
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} must be a non-empty string`);
  return value.trim();
}

function nullableString(input: Input, key: string): string | null | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`${key} must be a string or null`);
  return value.trim();
}

function record(input: Input, key: string): Record<string, string> | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${key} must be an object`);
  return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, String(item)]));
}

function jsonObject(input: Input, key: string): Record<string, unknown> | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${key} must be an object`);
  return value as Record<string, unknown>;
}

function boolean(input: Input, key: string): boolean | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(`${key} must be a boolean`);
  return value;
}

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const stringSchema = { type: "string" };
const nullableStringSchema = { type: ["string", "null"] };
const booleanSchema = { type: "boolean" };
const dateSchema = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Calendar date in YYYY-MM-DD format; never a timestamp." };
const jsonObjectSchema = { type: "object", additionalProperties: true };

export function createApplicationTools(db: MoeDatabase): ToolMap {
  return {
    search_subjects: {
      description: "Search the user's durable Subjects before creating or referring to one.",
      parameters: objectSchema({ query: stringSchema, include_archived: booleanSchema }, ["query"]),
      handler: (raw) => {
        const input = object(raw);
        return db.searchSubjects(string(input, "query")!, { includeArchived: boolean(input, "include_archived") });
      },
    },
    get_subject: {
      description: "Get one Subject, its active maintenance, and complete Event history. Treat history as evidence for current readings, prior work, condition, and findings rather than copying those facts into Subject attributes.",
      parameters: objectSchema({ id: stringSchema }, ["id"]),
      handler: (raw) => {
        const id = string(object(raw), "id")!;
        const subject = db.getSubject(id);
        if (!subject) throw new Error("Subject not found");
        return { subject, maintenance: db.listMaintenance({ subjectId: id }), history: db.getHistory(id) };
      },
    },
    create_subject: {
      description: "Create a durable Subject after search confirms it is not already represented. Save specific identity attributes only when the user confirmed them or the evidence is strong enough for the current decision.",
      parameters: objectSchema({
        name: stringSchema,
        category: nullableStringSchema,
        attributes: { type: "object", additionalProperties: { type: "string" } },
        care_preferences: nullableStringSchema,
      }, ["name"]),
      handler: (raw) => {
        const input = object(raw);
        return db.createSubject({
          name: string(input, "name")!,
          category: nullableString(input, "category"),
          attributes: record(input, "attributes"),
          carePreferences: nullableString(input, "care_preferences"),
        });
      },
    },
    update_subject: {
      description: "Update a Subject's identity, attributes, or natural-language care preferences. Care preferences describe how the user wants to care for it, not uncertain identity or research notes.",
      parameters: objectSchema({
        id: stringSchema,
        name: stringSchema,
        category: nullableStringSchema,
        attributes: { type: "object", additionalProperties: { type: "string" } },
        care_preferences: nullableStringSchema,
      }, ["id"]),
      handler: (raw) => {
        const input = object(raw);
        const updated = db.updateSubject(string(input, "id")!, {
          name: string(input, "name", false),
          category: nullableString(input, "category"),
          attributes: record(input, "attributes"),
          carePreferences: nullableString(input, "care_preferences"),
        });
        if (!updated) throw new Error("Subject not found");
        return updated;
      },
    },
    archive_subject: {
      description: "Retire or replace a Subject without deleting its history. Use merge_subjects instead when two records represent the same physical object.",
      parameters: objectSchema({ id: stringSchema }, ["id"]),
      handler: (raw) => {
        const archived = db.archiveSubject(string(object(raw), "id")!);
        if (!archived) throw new Error("Subject not found");
        return archived;
      },
    },
    merge_subjects: {
      description: "Atomically combine two records that evidence establishes are the same physical object. You choose the surviving ID and provide the complete final Subject. The tool moves all history and maintenance, archives the absorbed record, and does not infer, blend, or deduplicate fields for you.",
      parameters: objectSchema({
        keep_id: stringSchema,
        absorb_id: stringSchema,
        survivor: objectSchema({
          name: stringSchema,
          category: nullableStringSchema,
          attributes: { type: "object", additionalProperties: { type: "string" } },
          care_preferences: nullableStringSchema,
        }, ["name", "category", "attributes", "care_preferences"]),
      }, ["keep_id", "absorb_id", "survivor"]),
      handler: (raw) => {
        const input = object(raw);
        const survivor = object(input.survivor);
        return db.mergeSubjects({
          keepId: string(input, "keep_id")!,
          absorbId: string(input, "absorb_id")!,
          survivor: {
            name: string(survivor, "name")!,
            category: nullableString(survivor, "category")!,
            attributes: record(survivor, "attributes")!,
            carePreferences: nullableString(survivor, "care_preferences")!,
          },
        });
      },
    },
    get_history: {
      description: "List durable maintenance and observation history, optionally for one Subject.",
      parameters: objectSchema({ subject_id: stringSchema }),
      handler: (raw) => db.getHistory(string(object(raw), "subject_id", false)),
    },
    record_event: {
      description: "Record a canonical historical fact, measurement, or observation that is not already recorded by completing a maintenance item. Put readings, condition, findings, and provenance in details instead of copying them into Subject attributes.",
      parameters: objectSchema({
        subject_id: stringSchema,
        summary: stringSchema,
        occurred_at: stringSchema,
        source: nullableStringSchema,
        details: jsonObjectSchema,
      }, ["summary"]),
      handler: (raw) => {
        const input = object(raw);
        const source = nullableString(input, "source");
        const details = jsonObject(input, "details");
        return db.recordEvent({
          subjectId: string(input, "subject_id", false),
          summary: string(input, "summary")!,
          occurredAt: string(input, "occurred_at", false),
          data: {
            ...(source === undefined ? {} : { source }),
            ...(details === undefined ? {} : { details }),
          },
        });
      },
    },
    update_event: {
      description: "Explicitly correct or reassign an existing canonical Event when later evidence shows it is wrong. Events should otherwise remain unchanged.",
      parameters: objectSchema({
        id: stringSchema,
        subject_id: nullableStringSchema,
        summary: stringSchema,
        occurred_at: stringSchema,
        source: nullableStringSchema,
        details: jsonObjectSchema,
      }, ["id"]),
      handler: (raw) => {
        const input = object(raw);
        const source = nullableString(input, "source");
        const details = jsonObject(input, "details");
        const data = source === undefined && details === undefined
          ? undefined
          : {
              ...(source === undefined ? {} : { source }),
              ...(details === undefined ? {} : { details }),
            };
        const updated = db.updateEvent(string(input, "id")!, {
          subjectId: nullableString(input, "subject_id"),
          summary: string(input, "summary", false),
          occurredAt: string(input, "occurred_at", false),
          data,
        });
        if (!updated) throw new Error("Event not found");
        return updated;
      },
    },
    list_maintenance: {
      description: "List active maintenance in attention order, optionally for one Subject.",
      parameters: objectSchema({ subject_id: stringSchema }),
      handler: (raw) => db.listMaintenance({ subjectId: string(object(raw), "subject_id", false) }),
    },
    create_maintenance: {
      description: "Create a useful future maintenance item at the granularity the user acts on. Always choose an honest calendar due date from available evidence; do not guess from mileage, season, or an interval when its starting point is unknown. Composite items can retain source and included operations in details.",
      parameters: objectSchema({
        subject_id: stringSchema,
        title: stringSchema,
        due_date: dateSchema,
        rationale: nullableStringSchema,
        source: nullableStringSchema,
        details: jsonObjectSchema,
      }, ["title", "due_date"]),
      handler: (raw) => {
        const input = object(raw);
        const source = nullableString(input, "source");
        const details = jsonObject(input, "details");
        return db.createMaintenance({
          subjectId: string(input, "subject_id", false),
          title: string(input, "title")!,
          dueDate: string(input, "due_date")!,
          rationale: nullableString(input, "rationale"),
          data: {
            ...(source === undefined ? {} : { source }),
            ...(details === undefined ? {} : { details }),
          },
        });
      },
    },
    update_maintenance: {
      description: "Update, reschedule, archive, or complete a planned maintenance item. Reschedule with a concrete due_date, never a vague bucket. Archive an obsolete intention without recording completion. source and details edit the plan. On completion, completion_summary, completion_source, and completion_details describe what actually happened; the application atomically records them in a linked canonical Event without overwriting the plan.",
      parameters: objectSchema({
        id: stringSchema,
        subject_id: nullableStringSchema,
        title: stringSchema,
        status: { type: "string", enum: ["active", "done", "archived"] },
        due_date: dateSchema,
        rationale: nullableStringSchema,
        occurred_at: stringSchema,
        source: nullableStringSchema,
        details: jsonObjectSchema,
        completion_summary: stringSchema,
        completion_source: nullableStringSchema,
        completion_details: jsonObjectSchema,
      }, ["id"]),
      handler: (raw) => {
        const input = object(raw);
        const status = string(input, "status", false) as MaintenanceStatus | undefined;
        const source = nullableString(input, "source");
        const details = jsonObject(input, "details");
        const completionSummary = string(input, "completion_summary", false);
        const completionSource = nullableString(input, "completion_source");
        const completionDetails = jsonObject(input, "completion_details");
        if (
          status !== "done"
          && (completionSummary !== undefined || completionSource !== undefined || completionDetails !== undefined)
        ) {
          throw new Error("completion fields require status done");
        }
        const data = source === undefined && details === undefined
          ? undefined
          : {
              ...(source === undefined ? {} : { source }),
              ...(details === undefined ? {} : { details }),
            };
        const updated = db.updateMaintenance(string(input, "id")!, {
          subjectId: nullableString(input, "subject_id"),
          title: string(input, "title", false),
          status,
          dueDate: string(input, "due_date", false),
          rationale: nullableString(input, "rationale"),
          occurredAt: string(input, "occurred_at", false),
          data,
          completion: status === "done"
            ? {
                ...(completionSummary === undefined ? {} : { summary: completionSummary }),
                ...(completionSource === undefined ? {} : { source: completionSource }),
                ...(completionDetails === undefined ? {} : { details: completionDetails }),
              }
            : undefined,
        });
        if (!updated) throw new Error("Maintenance item not found");
        return updated;
      },
    },
  };
}
