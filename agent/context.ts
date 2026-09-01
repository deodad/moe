import { AGENT_INSTRUCTIONS } from "@/agent/instructions";
import type { Subject } from "@/lib/types";

export function agentInstructionsWithSubjects(subjects: Subject[], focusedSubject?: Subject | null) {
  const index = subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    category: subject.category,
    attributes: subject.attributes,
    carePreferences: subject.carePreferences,
  }));

  return `${AGENT_INSTRUCTIONS}

Current durable Subjects are listed below. Treat this as the complete candidate set for identity resolution and use these IDs with application tools. Existing identity can still be incomplete or mistaken.

${JSON.stringify(index, null, 2)}

${focusedSubject ? `The user is currently in the Subject workspace for "${focusedSubject.name}" (ID: ${focusedSubject.id}). Treat references such as "it", "this", and "my subject" as referring to this Subject unless the user's message clearly indicates otherwise. Keep the response relevant to this Subject while still handling explicit references to other Subjects normally.` : "The user is in the general chat workspace; do not assume a focused Subject."}`;
}
