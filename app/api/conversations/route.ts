import { getDatabase } from "@/lib/database";

export const runtime = "nodejs";

export async function POST() {
  return Response.json(getDatabase().createConversation(), { status: 201 });
}
