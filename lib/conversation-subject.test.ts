import { describe, expect, it } from "vitest";
import { currentConversationSubjectId } from "@/lib/conversation-subject";
import type { Conversation, Subject, ToolActivity } from "@/lib/types";

const subject: Subject = {
  id: "subject-1",
  name: "4Runner",
  category: "Vehicle",
  attributes: {},
  carePreferences: null,
  archivedAt: null,
  mergedIntoId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function conversationWith(activity: ToolActivity): Conversation {
  return {
    id: "conversation-1",
    title: "4Runner",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    messages: [{
      id: "message-1",
      role: "assistant",
      text: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      activities: [activity],
    }],
  };
}

describe("currentConversationSubjectId", () => {
  it("restores a Subject resolved by a completed tool call", () => {
    const conversation = conversationWith({
      callId: "call-1",
      tool: "get_subject",
      status: "complete",
      result: subject,
    });

    expect(currentConversationSubjectId(conversation, [subject])).toBe(subject.id);
  });

  it("uses a single search result but not an ambiguous result set", () => {
    const oneResult = conversationWith({
      callId: "call-1",
      tool: "search_subjects",
      status: "complete",
      result: [subject],
    });
    const twoResults = conversationWith({
      callId: "call-2",
      tool: "search_subjects",
      status: "complete",
      result: [subject, { ...subject, id: "subject-2", name: "House" }],
    });

    expect(currentConversationSubjectId(oneResult, [subject])).toBe(subject.id);
    expect(currentConversationSubjectId(twoResults, [subject, { ...subject, id: "subject-2" }])).toBeNull();
  });

  it("updates from completed streaming activity", () => {
    const activity: ToolActivity = {
      callId: "call-1",
      tool: "record_event",
      status: "complete",
      arguments: { subject_id: subject.id },
    };

    expect(currentConversationSubjectId(undefined, [subject], [activity])).toBe(subject.id);
  });
});
