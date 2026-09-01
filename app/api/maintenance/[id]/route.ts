import { getDatabase } from "@/lib/database";
import { addMonths, dateOnly } from "@/lib/maintenance-schedule";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json() as { action?: "done" | "later" };
  const db = getDatabase();
  const updated = body.action === "done"
    ? db.updateMaintenance(id, { status: "done" })
    : body.action === "later"
      ? (() => {
          const current = db.getMaintenance(id);
          if (!current) return null;
          const base = current.dueDate < dateOnly() ? dateOnly() : current.dueDate;
          return db.updateMaintenance(id, { dueDate: addMonths(base, 1) });
        })()
      : null;

  if (!updated) return Response.json({ error: "Maintenance item or action not found" }, { status: 404 });
  return Response.json({ item: updated, state: db.getState() });
}
