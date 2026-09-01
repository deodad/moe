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
          if (current.due.date) {
            const base = current.due.date < dateOnly() ? dateOnly() : current.due.date;
            return db.updateMaintenance(id, { due: { ...current.due, date: addMonths(base, 1) } });
          }
          const base = current.checkOn && current.checkOn >= dateOnly() ? current.checkOn : dateOnly();
          return db.updateMaintenance(id, { checkOn: addMonths(base, 1) });
        })()
      : null;

  if (!updated) return Response.json({ error: "Maintenance item or action not found" }, { status: 404 });
  return Response.json({ item: updated, state: db.getState() });
}
