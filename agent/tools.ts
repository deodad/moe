import type { ToolMap } from "nanocodex";
import type { MoeDatabase } from "@/lib/database";
import type { MaintenanceStatus, Timing } from "@/lib/types";

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

const timingValues: Timing[] = ["overdue", "this_week", "this_month", "later"];

function timing(input: Input, required = false): Timing | undefined {
  const value = input.timing;
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || !timingValues.includes(value as Timing)) {
    throw new Error(`timing must be one of ${timingValues.join(", ")}`);
  }
  return value as Timing;
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
const timingSchema = { type: "string", enum: timingValues };
const jsonObjectSchema = { type: "object", additionalProperties: true };

export function createApplicationTools(db: MoeDatabase): ToolMap {
  return {
    search_things: {
      description: "Search the user's durable Things before creating or referring to one.",
      parameters: objectSchema({ query: stringSchema, include_archived: booleanSchema }, ["query"]),
      handler: (raw) => {
        const input = object(raw);
        return db.searchThings(string(input, "query")!, { includeArchived: boolean(input, "include_archived") });
      },
    },
    get_thing: {
      description: "Get one Thing, its active maintenance, and recent Events. Treat history as evidence for current readings, prior work, condition, and findings rather than copying those facts into Thing attributes.",
      parameters: objectSchema({ id: stringSchema }, ["id"]),
      handler: (raw) => {
        const id = string(object(raw), "id")!;
        const thing = db.getThing(id);
        if (!thing) throw new Error("Thing not found");
        return { thing, maintenance: db.listMaintenance({ thingId: id }), history: db.getHistory(id).slice(0, 10) };
      },
    },
    create_thing: {
      description: "Create a durable Thing after search confirms it is not already represented. Save specific identity attributes only when the user confirmed them or the evidence is strong enough for the current decision.",
      parameters: objectSchema({
        name: stringSchema,
        category: nullableStringSchema,
        attributes: { type: "object", additionalProperties: { type: "string" } },
        care_preferences: nullableStringSchema,
      }, ["name"]),
      handler: (raw) => {
        const input = object(raw);
        return db.createThing({
          name: string(input, "name")!,
          category: nullableString(input, "category"),
          attributes: record(input, "attributes"),
          carePreferences: nullableString(input, "care_preferences"),
        });
      },
    },
    update_thing: {
      description: "Update a Thing's identity, attributes, or natural-language care preferences. Care preferences describe how the user wants to care for it, not uncertain identity or research notes.",
      parameters: objectSchema({
        id: stringSchema,
        name: stringSchema,
        category: nullableStringSchema,
        attributes: { type: "object", additionalProperties: { type: "string" } },
        care_preferences: nullableStringSchema,
      }, ["id"]),
      handler: (raw) => {
        const input = object(raw);
        const updated = db.updateThing(string(input, "id")!, {
          name: string(input, "name", false),
          category: nullableString(input, "category"),
          attributes: record(input, "attributes"),
          carePreferences: nullableString(input, "care_preferences"),
        });
        if (!updated) throw new Error("Thing not found");
        return updated;
      },
    },
    archive_thing: {
      description: "Retire or replace a Thing without deleting its history. Use merge_things instead when two records represent the same physical object.",
      parameters: objectSchema({ id: stringSchema }, ["id"]),
      handler: (raw) => {
        const archived = db.archiveThing(string(object(raw), "id")!);
        if (!archived) throw new Error("Thing not found");
        return archived;
      },
    },
    merge_things: {
      description: "Atomically combine two records that evidence establishes are the same physical object. You choose the surviving ID and provide the complete final Thing. The tool moves all history and maintenance, archives the absorbed record, and does not infer, blend, or deduplicate fields for you.",
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
        return db.mergeThings({
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
      description: "List durable maintenance and observation history, optionally for one Thing.",
      parameters: objectSchema({ thing_id: stringSchema }),
      handler: (raw) => db.getHistory(string(object(raw), "thing_id", false)),
    },
    record_event: {
      description: "Record a canonical historical fact, measurement, or observation that is not already recorded by completing a maintenance item. Put readings, condition, findings, and provenance in details instead of copying them into Thing attributes.",
      parameters: objectSchema({
        thing_id: stringSchema,
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
          thingId: string(input, "thing_id", false),
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
        thing_id: nullableStringSchema,
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
          thingId: nullableString(input, "thing_id"),
          summary: string(input, "summary", false),
          occurredAt: string(input, "occurred_at", false),
          data,
        });
        if (!updated) throw new Error("Event not found");
        return updated;
      },
    },
    list_maintenance: {
      description: "List active maintenance in attention order, optionally for one Thing.",
      parameters: objectSchema({ thing_id: stringSchema }),
      handler: (raw) => db.listMaintenance({ thingId: string(object(raw), "thing_id", false) }),
    },
    create_maintenance: {
      description: "Create a useful future maintenance item at the granularity the user acts on. Composite items can retain source and included operations in details.",
      parameters: objectSchema({
        thing_id: stringSchema,
        title: stringSchema,
        timing: timingSchema,
        rationale: nullableStringSchema,
        source: nullableStringSchema,
        details: jsonObjectSchema,
      }, ["title", "timing"]),
      handler: (raw) => {
        const input = object(raw);
        const source = nullableString(input, "source");
        const details = jsonObject(input, "details");
        return db.createMaintenance({
          thingId: string(input, "thing_id", false),
          title: string(input, "title")!,
          timing: timing(input, true),
          rationale: nullableString(input, "rationale"),
          data: {
            ...(source === undefined ? {} : { source }),
            ...(details === undefined ? {} : { details }),
          },
        });
      },
    },
    update_maintenance: {
      description: "Update, defer, or complete a planned maintenance item. source and details edit the plan. On completion, completion_summary, completion_source, and completion_details describe what actually happened; the application atomically records them in a linked canonical Event without overwriting the plan.",
      parameters: objectSchema({
        id: stringSchema,
        thing_id: nullableStringSchema,
        title: stringSchema,
        status: { type: "string", enum: ["active", "done"] },
        timing: timingSchema,
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
          thingId: nullableString(input, "thing_id"),
          title: string(input, "title", false),
          status,
          timing: timing(input),
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
