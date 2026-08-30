"use client";

import { Check, Clock3 } from "lucide-react";
import type { MaintenanceItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const labels = {
  overdue: "Overdue",
  this_week: "This week",
  this_month: "This month",
  later: "Later",
};

export function MaintenanceCard({
  item,
  compact = false,
  onAction,
}: {
  item: MaintenanceItem;
  compact?: boolean;
  onAction?: (id: string, action: "done" | "later") => Promise<void> | void;
}) {
  return (
    <article>
      <Card className={compact ? "rounded-xl" : undefined}>
        <CardContent className={compact ? "p-4" : "p-5"}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold tracking-[-0.01em] text-stone-950">{item.title}</p>
            {item.thingName && <p className="mt-0.5 text-sm text-stone-500">{item.thingName}</p>}
          </div>
          <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
            {labels[item.timing]}
          </span>
        </div>
        {!compact && item.rationale && <p className="mt-3 text-sm leading-6 text-stone-600">{item.rationale}</p>}
        {onAction && (
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => onAction(item.id, "done")}>
              <Check className="size-3.5" /> Done
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAction(item.id, "later")}>
              <Clock3 className="size-3.5" /> Later
            </Button>
          </div>
        )}
        </CardContent>
      </Card>
    </article>
  );
}
