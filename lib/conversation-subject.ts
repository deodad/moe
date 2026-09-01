import type { Conversation, Subject, ToolActivity } from "@/lib/types";

function parseResult(result: unknown): unknown {
  if (typeof result !== "string") return result;
  try { return JSON.parse(result) as unknown; } catch { return result; }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function knownSubjectId(value: unknown, subjectIds: Set<string>) {
  return typeof value === "string" && subjectIds.has(value) ? value : null;
}

function subjectIdFromActivity(activity: ToolActivity, subjectIds: Set<string>) {
  if (activity.status !== "complete") return null;

  const result = parseResult(activity.result);
  const resultRecord = record(result);
  const nestedSubject = resultRecord ? record(resultRecord.subject) : null;
  const directId = knownSubjectId(nestedSubject?.id ?? resultRecord?.id, subjectIds);
  if (directId) return directId;

  const resultSubjectId = knownSubjectId(resultRecord?.subjectId ?? resultRecord?.subject_id, subjectIds);
  if (resultSubjectId) return resultSubjectId;

  if (Array.isArray(result) && result.length === 1) {
    const onlyResult = record(result[0]);
    const onlyId = knownSubjectId(onlyResult?.id, subjectIds);
    if (onlyId) return onlyId;
  }

  const args = activity.arguments ?? {};
  const argumentSubjectId = knownSubjectId(args.subject_id ?? args.subjectId, subjectIds);
  if (argumentSubjectId) return argumentSubjectId;

  if (["get_subject", "update_subject", "archive_subject"].includes(activity.tool)) {
    return knownSubjectId(args.id, subjectIds);
  }

  return null;
}

export function currentConversationSubjectId(
  conversation: Conversation | undefined,
  subjects: Subject[],
  streamingActivities: ToolActivity[] = [],
) {
  const subjectIds = new Set(subjects.map((subject) => subject.id));
  const activities = [
    ...conversation?.messages.flatMap((message) => message.activities ?? []) ?? [],
    ...streamingActivities,
  ];

  for (let index = activities.length - 1; index >= 0; index -= 1) {
    const subjectId = subjectIdFromActivity(activities[index], subjectIds);
    if (subjectId) return subjectId;
  }

  return null;
}
