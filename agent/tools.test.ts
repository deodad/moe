import { describe, expect, it } from "vitest";
import { createApplicationTools } from "@/agent/tools";
import { MoeDatabase } from "@/lib/database";

async function call(tools: ReturnType<typeof createApplicationTools>, name: string, input: unknown) {
  return tools[name].handler(input, { callId: "test", parentCallId: "", sessionId: "test" });
}

describe("application tools", () => {
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
    }) as { id: string };

    await call(tools, "update_thing", {
      id: thing.id,
      care_preferences: "Keep forever. Toyota handles scheduled service; track service intervals, not separate inspections.",
    });
    await call(tools, "update_maintenance", {
      id: firstService.id,
      status: "done",
      occurred_at: "2026-08-29T12:00:00.000Z",
    });
    await call(tools, "create_maintenance", {
      thing_id: thing.id,
      title: "10,000-mile service",
      timing: "later",
      rationale: "Next shop service interval.",
    });

    expect(db.getThing(thing.id)?.carePreferences).toContain("Toyota handles scheduled service");
    expect(db.getHistory(thing.id).map((event) => event.summary)).toEqual(["5,000-mile service completed"]);
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
      "get_history",
      "record_event",
      "list_maintenance",
      "create_maintenance",
      "update_maintenance",
    ]);
    db.close();
  });
});
