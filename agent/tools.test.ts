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
    const subject = db.createSubject({ name: "Baratza Encore", attributes: { model: "Encore" } });

    const event = await call(tools, "record_event", {
      subject_id: subject.id,
      summary: "Burrs inspected",
      occurred_at: "2026-08-30",
      source: "Owner observation",
      details: { condition: "Clean", coffee_throughput: "18 lb" },
    }) as { id: string };

    expect(db.getEvent(event.id)?.data).toEqual({
      source: "Owner observation",
      details: { condition: "Clean", coffee_throughput: "18 lb" },
    });
    expect(db.getSubject(subject.id)?.attributes).toEqual({ model: "Encore" });
    db.close();
  });

  it("archives obsolete maintenance without creating history", async () => {
    const db = new MoeDatabase(":memory:", false);
    const tools = createApplicationTools(db);
    const subject = db.createSubject({ name: "Dyson V15 Detect" });
    const item = db.createMaintenance({ subjectId: subject.id, title: "Replace battery", timing: "later" });

    await call(tools, "update_maintenance", { id: item.id, status: "archived" });

    expect(db.getMaintenance(item.id)?.status).toBe("archived");
    expect(db.listMaintenance({ subjectId: subject.id })).toEqual([]);
    expect(db.getHistory(subject.id)).toEqual([]);
    db.close();
  });

  it("loads a Subject with its artifacts, complete history, and active maintenance", async () => {
    const db = new MoeDatabase(":memory:", false);
    const tools = createApplicationTools(db);
    const subject = db.createSubject({ name: "4Runner", carePreferences: "Uses a Toyota shop." });
    for (let index = 0; index < 12; index += 1) {
      db.recordEvent({ subjectId: subject.id, summary: `Service record ${index + 1}` });
    }
    db.createMaintenance({ subjectId: subject.id, title: "Next Toyota service" });
    db.createArtifact({ subjectId: subject.id, title: "Long-term ownership plan", content: "# Long-term ownership" });

    const context = await call(tools, "get_subject", { id: subject.id }) as {
      subject: { id: string };
      artifacts: unknown[];
      history: unknown[];
      maintenance: unknown[];
    };

    expect(context.subject.id).toBe(subject.id);
    expect(context.artifacts).toHaveLength(1);
    expect(context.history).toHaveLength(12);
    expect(context.maintenance).toHaveLength(1);
    db.close();
  });

  it("creates and revises an artifact for a Subject", async () => {
    const db = new MoeDatabase(":memory:", false);
    const tools = createApplicationTools(db);
    const subject = db.createSubject({ name: "House" });

    const artifact = await call(tools, "create_artifact", {
      subject_id: subject.id,
      title: "Kitchen renovation plan",
      content: "# Kitchen renovation\n\n## Next step\n\nPhotograph each wall.",
    }) as { id: string };
    await call(tools, "update_artifact", {
      id: artifact.id,
      content: "# Kitchen renovation\n\n## Next step\n\nMeasure the room.",
    });

    expect(await call(tools, "get_artifact", { id: artifact.id })).toMatchObject({
      subjectId: subject.id,
      title: "Kitchen renovation plan",
      content: "# Kitchen renovation\n\n## Next step\n\nMeasure the room.",
    });
    db.close();
  });

  it("supports the complete 4Runner flow with small primitives", async () => {
    const db = new MoeDatabase(":memory:", false);
    const tools = createApplicationTools(db);

    expect(await call(tools, "search_subjects", { query: "4Runner" })).toEqual([]);
    const subject = await call(tools, "create_subject", {
      name: "4Runner",
      category: "Vehicle",
      attributes: { year: "2026", make: "Toyota", model: "4Runner" },
      care_preferences: "Keep forever. Proactive about worthwhile reliability maintenance.",
    }) as { id: string };

    const firstService = await call(tools, "create_maintenance", {
      subject_id: subject.id,
      title: "5,000-mile service",
      due: { date: "2026-10-15", condition: "At 5,000 miles" },
      rationale: "Initial Toyota service interval.",
      source: "Toyota maintenance guide",
      details: { operations: ["Rotate tires", "Inspect brakes"] },
    }) as { id: string };

    await call(tools, "update_subject", {
      id: subject.id,
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
      subject_id: subject.id,
      title: "10,000-mile service",
      due: { condition: "At 10,000 miles" },
      check_on: "2027-02-15",
      rationale: "Next shop service interval.",
    });

    expect(db.getSubject(subject.id)?.carePreferences).toContain("Toyota handles scheduled service");
    expect(db.getMaintenance(firstService.id)?.data).toEqual({
      source: "Toyota maintenance guide",
      details: { operations: ["Rotate tires", "Inspect brakes"] },
    });
    expect(db.getHistory(subject.id)[0]).toMatchObject({
      summary: "Toyota 5,000-mile service completed",
      data: {
        maintenanceItemId: firstService.id,
        source: "Owner report",
        details: { odometer: "5,120 miles", provider: "Toyota" },
      },
    });
    expect(db.listMaintenance({ subjectId: subject.id }).map((item) => item.title)).toEqual(["10,000-mile service"]);
    db.close();
  });

  it("exposes exactly the prototype application tools", () => {
    const db = new MoeDatabase(":memory:", false);
    expect(Object.keys(createApplicationTools(db))).toEqual([
      "search_subjects",
      "get_subject",
      "create_subject",
      "update_subject",
      "archive_subject",
      "merge_subjects",
      "get_artifact",
      "create_artifact",
      "update_artifact",
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
