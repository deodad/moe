import { AGENT_INSTRUCTIONS } from "@/agent/instructions";
import type { Thing } from "@/lib/types";

export function agentInstructionsWithThings(things: Thing[]) {
  const index = things.map((thing) => ({
    id: thing.id,
    name: thing.name,
    category: thing.category,
    attributes: thing.attributes,
    carePreferences: thing.carePreferences,
  }));

  return `${AGENT_INSTRUCTIONS}

Current durable Things are listed below. Treat this as the complete candidate set for identity resolution and use these IDs with application tools. Existing identity can still be incomplete or mistaken.

${JSON.stringify(index, null, 2)}`;
}
