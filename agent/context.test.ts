import { describe, expect, it } from "vitest";
import { agentInstructionsWithSubjects } from "@/agent/context";

describe("agentInstructionsWithSubjects", () => {
  it("includes the complete compact Subject index with stable IDs", () => {
    const instructions = agentInstructionsWithSubjects([{
      id: "subject-1",
      name: "Dyson V15 Detect",
      category: "Appliance",
      attributes: { model: "V15 Detect" },
      carePreferences: "Group routine care.",
      agentContext: "The upstairs filter size may be 16x25x1, but this is unconfirmed.",
      archivedAt: null,
      mergedIntoId: null,
      createdAt: "2026-08-30T00:00:00.000Z",
    }]);

    expect(instructions).toContain('"id": "subject-1"');
    expect(instructions).toContain('"name": "Dyson V15 Detect"');
    expect(instructions).toContain('"model": "V15 Detect"');
    expect(instructions).toContain('"carePreferences": "Group routine care."');
    expect(instructions).not.toContain("16x25x1");
    expect(instructions).not.toContain("createdAt");
  });

  it("identifies the Subject currently in view", () => {
    const subject = {
      id: "subject-1",
      name: "4Runner",
      category: "Vehicle",
      attributes: { year: "2019" },
      carePreferences: "Keep long term.",
      agentContext: null,
      archivedAt: null,
      mergedIntoId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const instructions = agentInstructionsWithSubjects([subject], subject);

    expect(instructions).toContain('currently in the Subject workspace for "4Runner"');
    expect(instructions).toContain("subject-1");
    expect(instructions).toContain('references such as "it", "this"');
  });
});
