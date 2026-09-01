"use client";

import type { MaintenanceItem, Timing } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const timing: Record<Timing, { label: string; className: string }> = {
  overdue: { label: "Overdue", className: "border-destructive/50 bg-destructive/10 text-destructive" },
  this_week: { label: "This week", className: "border-warning/50 bg-warning/10 text-warning" },
  this_month: { label: "This month", className: "border-line-strong bg-transparent text-foreground" },
  later: { label: "Later", className: "border-border bg-muted text-muted-foreground" },
};

/** A compact maintenance record for chat tool-activity drops — one bordered row, not a full ledger row. */
export function MaintenanceCard({
  item,
  onAction,
}: {
  item: MaintenanceItem;
  onAction?: (id: string, action: "done" | "later") => Promise<void> | void;
}) {
  return (
    <div className="flex flex-col gap-2 border border-border bg-card px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          {item.thingName && <p className="text-xs text-muted-foreground">{item.thingName}</p>}
        </div>
        <Badge variant="outline" className={timing[item.timing].className}>{timing[item.timing].label}</Badge>
      </div>
      {onAction && (
        <div className="flex gap-1.5">
          <Button size="sm" onClick={() => onAction(item.id, "done")}>
            Done
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAction(item.id, "later")}>
            Later
          </Button>
        </div>
      )}
    </div>
  );
}
