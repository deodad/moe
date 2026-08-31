import { describe, expect, it } from "vitest";
import { agentInstructionsWithThings } from "@/agent/context";

describe("agentInstructionsWithThings", () => {
  it("includes the complete compact Thing index with stable IDs", () => {
    const instructions = agentInstructionsWithThings([{
      id: "thing-1",
      name: "Dyson V15 Detect",
      category: "Appliance",
      attributes: { model: "V15 Detect" },
      carePreferences: "Group routine care.",
      archivedAt: null,
      mergedIntoId: null,
      createdAt: "2026-08-30T00:00:00.000Z",
    }]);

    expect(instructions).toContain('"id": "thing-1"');
    expect(instructions).toContain('"name": "Dyson V15 Detect"');
    expect(instructions).toContain('"model": "V15 Detect"');
    expect(instructions).toContain('"carePreferences": "Group routine care."');
    expect(instructions).not.toContain("createdAt");
  });
});
