import { AGENT_INSTRUCTIONS } from "@/agent/instructions";
import type { Subject } from "@/lib/types";

export function agentInstructionsWithSubjects(subjects: Subject[]) {
  const index = subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    category: subject.category,
    attributes: subject.attributes,
    carePreferences: subject.carePreferences,
  }));

  return `${AGENT_INSTRUCTIONS}

Current durable Subjects are listed below. Treat this as the complete candidate set for identity resolution and use these IDs with application tools. Existing identity can still be incomplete or mistaken.

${JSON.stringify(index, null, 2)}`;
}
