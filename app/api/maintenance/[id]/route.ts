import { getDatabase } from "@/lib/database";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json() as { action?: "done" | "later" };
  const db = getDatabase();
  const updated = body.action === "done"
    ? db.updateMaintenance(id, { status: "done" })
    : body.action === "later"
      ? db.updateMaintenance(id, { timing: "later" })
      : null;

  if (!updated) return Response.json({ error: "Maintenance item or action not found" }, { status: 404 });
  return Response.json({ item: updated, state: db.getState() });
}
