"use client";

import type { MaintenanceItem, Timing } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";

const timing: Record<Timing, { label: string; className: string }> = {
  overdue: { label: "Overdue", className: "border-destructive/50 bg-destructive/10 text-destructive" },
  this_week: { label: "This week", className: "border-warning/50 bg-warning/10 text-warning" },
  this_month: { label: "This month", className: "border-line-strong bg-transparent text-foreground" },
  later: { label: "Later", className: "border-border bg-muted text-muted-foreground" },
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

export function MaintenanceRow({
  item,
  onAction,
}: {
  item: MaintenanceItem;
  onAction: (id: string, action: "done" | "later") => Promise<void> | void;
}) {
  const operations = includedOperations(item);
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap align-top">
        <Badge variant="outline" className={timing[item.timing].className}>{timing[item.timing].label}</Badge>
      </TableCell>
      <TableCell className="align-top whitespace-normal">
        <p className="font-medium text-foreground">{item.title}</p>
        {item.rationale && <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.rationale}</p>}
        {operations.length > 0 && (
          <details className="mt-1.5 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-mono tracking-wide text-foreground uppercase">See what&apos;s included</summary>
            <ul className="mt-1.5 list-disc space-y-1 pl-5">
              {operations.map((operation) => <li key={operation}>{operation}</li>)}
            </ul>
          </details>
        )}
      </TableCell>
      <TableCell className="align-top text-sm whitespace-nowrap text-muted-foreground">{item.thingName ?? "—"}</TableCell>
      <TableCell className="align-top">
        <div className="flex justify-end gap-1.5">
          <Button size="sm" onClick={() => onAction(item.id, "done")}>
            Done
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAction(item.id, "later")}>
            Later
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
