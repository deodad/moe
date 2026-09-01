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
      archivedAt: null,
      mergedIntoId: null,
      createdAt: "2026-08-30T00:00:00.000Z",
    }]);

    expect(instructions).toContain('"id": "subject-1"');
    expect(instructions).toContain('"name": "Dyson V15 Detect"');
    expect(instructions).toContain('"model": "V15 Detect"');
    expect(instructions).toContain('"carePreferences": "Group routine care."');
    expect(instructions).not.toContain("createdAt");
  });
});
