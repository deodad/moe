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
const timingSchema = { type: "string", enum: timingValues };

export function createApplicationTools(db: MoeDatabase): ToolMap {
  return {
    search_things: {
      description: "Search the user's durable Things before creating or referring to one.",
      parameters: objectSchema({ query: stringSchema }, ["query"]),
      handler: (raw) => db.searchThings(string(object(raw), "query")!),
    },
    get_thing: {
      description: "Get one Thing and its active maintenance and recent history.",
      parameters: objectSchema({ id: stringSchema }, ["id"]),
      handler: (raw) => {
        const id = string(object(raw), "id")!;
        const thing = db.getThing(id);
        if (!thing) throw new Error("Thing not found");
        return { thing, maintenance: db.listMaintenance({ thingId: id }), history: db.getHistory(id).slice(0, 10) };
      },
    },
    create_thing: {
      description: "Create a durable Thing after search confirms it is not already represented.",
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
      description: "Update a Thing's identity, attributes, or natural-language care preferences.",
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
    get_history: {
      description: "List durable maintenance and observation history, optionally for one Thing.",
      parameters: objectSchema({ thing_id: stringSchema }),
      handler: (raw) => db.getHistory(string(object(raw), "thing_id", false)),
    },
    record_event: {
      description: "Record a meaningful historical fact that is not already recorded by completing a maintenance item.",
      parameters: objectSchema({ thing_id: stringSchema, summary: stringSchema, occurred_at: stringSchema }, ["summary"]),
      handler: (raw) => {
        const input = object(raw);
        return db.recordEvent({
          thingId: string(input, "thing_id", false),
          summary: string(input, "summary")!,
          occurredAt: string(input, "occurred_at", false),
        });
      },
    },
    list_maintenance: {
      description: "List active maintenance in attention order, optionally for one Thing.",
      parameters: objectSchema({ thing_id: stringSchema }),
      handler: (raw) => db.listMaintenance({ thingId: string(object(raw), "thing_id", false) }),
    },
    create_maintenance: {
      description: "Create a useful future maintenance item at the granularity the user acts on.",
      parameters: objectSchema({
        thing_id: stringSchema,
        title: stringSchema,
        timing: timingSchema,
        rationale: nullableStringSchema,
      }, ["title", "timing"]),
      handler: (raw) => {
        const input = object(raw);
        return db.createMaintenance({
          thingId: string(input, "thing_id", false),
          title: string(input, "title")!,
          timing: timing(input, true),
          rationale: nullableString(input, "rationale"),
        });
      },
    },
    update_maintenance: {
      description: "Update, defer, or complete a maintenance item. Completion automatically records a history Event.",
      parameters: objectSchema({
        id: stringSchema,
        title: stringSchema,
        status: { type: "string", enum: ["active", "done"] },
        timing: timingSchema,
        rationale: nullableStringSchema,
        occurred_at: stringSchema,
      }, ["id"]),
      handler: (raw) => {
        const input = object(raw);
        const status = string(input, "status", false) as MaintenanceStatus | undefined;
        const updated = db.updateMaintenance(string(input, "id")!, {
          title: string(input, "title", false),
          status,
          timing: timing(input),
          rationale: nullableString(input, "rationale"),
          occurredAt: string(input, "occurred_at", false),
        });
        if (!updated) throw new Error("Maintenance item not found");
        return updated;
      },
    },
  };
}
