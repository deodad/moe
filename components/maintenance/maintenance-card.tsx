"use client";

import { Check, Clock3 } from "lucide-react";
import type { MaintenanceItem, Timing } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const timing: Record<Timing, { label: string; badgeClassName: string }> = {
  overdue: { label: "Overdue", badgeClassName: "bg-destructive/10 text-destructive" },
  this_week: { label: "This week", badgeClassName: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  this_month: { label: "This month", badgeClassName: "bg-secondary text-secondary-foreground" },
  later: { label: "Later", badgeClassName: "bg-muted text-muted-foreground" },
};

function includedOperations(item: MaintenanceItem) {
  const details = item.data.details;
  if (Array.isArray(details)) return details.filter((value): value is string => typeof value === "string");
  if (!details || typeof details !== "object") return [];
  for (const key of ["operations", "includes", "items"]) {
    const value = (details as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  }
  return [];
}

export function MaintenanceCard({
  item,
  compact = false,
  onAction,
}: {
  item: MaintenanceItem;
  compact?: boolean;
  onAction?: (id: string, action: "done" | "later") => Promise<void> | void;
}) {
  const operations = includedOperations(item);
  return (
    <Card size={compact ? "sm" : "default"}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium tracking-[-0.01em] text-foreground">{item.title}</p>
            {item.thingName && <p className="mt-0.5 text-sm text-muted-foreground">{item.thingName}</p>}
          </div>
          <Badge className={timing[item.timing].badgeClassName}>{timing[item.timing].label}</Badge>
        </div>
        {!compact && item.rationale && <p className="text-sm leading-6 text-muted-foreground">{item.rationale}</p>}
        {!compact && operations.length > 0 && (
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">See what&apos;s included</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {operations.map((operation) => <li key={operation}>{operation}</li>)}
            </ul>
          </details>
        )}
        {onAction && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onAction(item.id, "done")}>
              <Check /> Done
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAction(item.id, "later")}>
              <Clock3 /> Later
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
