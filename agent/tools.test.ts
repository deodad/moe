import { describe, expect, it } from "vitest";
import { createApplicationTools } from "@/agent/tools";
import { MoeDatabase } from "@/lib/database";

async function call(tools: ReturnType<typeof createApplicationTools>, name: string, input: unknown) {
  return tools[name].handler(input, {
    callId: "test",
    parentCallId: "",
    sessionId: "test",
    model: "gpt-5.6-luna",
    signal: new AbortController().signal,
  });
}

describe("application tools", () => {
  it("stores readings and findings in Event details", async () => {
    const db = new MoeDatabase(":memory:", false);
    const tools = createApplicationTools(db);
    const thing = db.createThing({ name: "Baratza Encore", attributes: { model: "Encore" } });

    const event = await call(tools, "record_event", {
      thing_id: thing.id,
      summary: "Burrs inspected",
      occurred_at: "2026-08-30",
      source: "Owner observation",
      details: { condition: "Clean", coffee_throughput: "18 lb" },
    }) as { id: string };

    expect(db.getEvent(event.id)?.data).toEqual({
      source: "Owner observation",
      details: { condition: "Clean", coffee_throughput: "18 lb" },
    });
    expect(db.getThing(thing.id)?.attributes).toEqual({ model: "Encore" });
    db.close();
  });

  it("archives obsolete maintenance without creating history", async () => {
    const db = new MoeDatabase(":memory:", false);
    const tools = createApplicationTools(db);
    const thing = db.createThing({ name: "Dyson V15 Detect" });
    const item = db.createMaintenance({ thingId: thing.id, title: "Replace battery", timing: "later" });

    await call(tools, "update_maintenance", { id: item.id, status: "archived" });

    expect(db.getMaintenance(item.id)?.status).toBe("archived");
    expect(db.listMaintenance({ thingId: thing.id })).toEqual([]);
    expect(db.getHistory(thing.id)).toEqual([]);
    db.close();
  });

  it("supports the complete 4Runner flow with small primitives", async () => {
    const db = new MoeDatabase(":memory:", false);
    const tools = createApplicationTools(db);

    expect(await call(tools, "search_things", { query: "4Runner" })).toEqual([]);
    const thing = await call(tools, "create_thing", {
      name: "4Runner",
      category: "Vehicle",
      attributes: { year: "2026", make: "Toyota", model: "4Runner" },
      care_preferences: "Keep forever. Proactive about worthwhile reliability maintenance.",
    }) as { id: string };

    const firstService = await call(tools, "create_maintenance", {
      thing_id: thing.id,
      title: "5,000-mile service",
      timing: "later",
      rationale: "Initial Toyota service interval.",
      source: "Toyota maintenance guide",
      details: { operations: ["Rotate tires", "Inspect brakes"] },
    }) as { id: string };

    await call(tools, "update_thing", {
      id: thing.id,
      care_preferences: "Keep forever. Toyota handles scheduled service; track service intervals, not separate inspections.",
    });
    await call(tools, "update_maintenance", {
      id: firstService.id,
      status: "done",
      occurred_at: "2026-08-29T12:00:00.000Z",
      completion_summary: "Toyota 5,000-mile service completed",
      completion_source: "Owner report",
      completion_details: { odometer: "5,120 miles", provider: "Toyota" },
    });
    await call(tools, "create_maintenance", {
      thing_id: thing.id,
      title: "10,000-mile service",
      timing: "later",
      rationale: "Next shop service interval.",
    });

    expect(db.getThing(thing.id)?.carePreferences).toContain("Toyota handles scheduled service");
    expect(db.getMaintenance(firstService.id)?.data).toEqual({
      source: "Toyota maintenance guide",
      details: { operations: ["Rotate tires", "Inspect brakes"] },
    });
    expect(db.getHistory(thing.id)[0]).toMatchObject({
      summary: "Toyota 5,000-mile service completed",
      data: {
        maintenanceItemId: firstService.id,
        source: "Owner report",
        details: { odometer: "5,120 miles", provider: "Toyota" },
      },
    });
    expect(db.listMaintenance({ thingId: thing.id }).map((item) => item.title)).toEqual(["10,000-mile service"]);
    db.close();
  });

  it("exposes exactly the prototype application tools", () => {
    const db = new MoeDatabase(":memory:", false);
    expect(Object.keys(createApplicationTools(db))).toEqual([
      "search_things",
      "get_thing",
      "create_thing",
      "update_thing",
      "archive_thing",
      "merge_things",
      "get_history",
      "record_event",
      "update_event",
      "list_maintenance",
      "create_maintenance",
      "update_maintenance",
    ]);
    db.close();
  });
});
