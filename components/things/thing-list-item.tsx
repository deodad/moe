import { Box, ChevronRight } from "lucide-react";
import type { Thing } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ThingListItem({ thing, selected, onClick }: { thing: Thing; selected?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
        selected ? "border-primary/40 bg-accent ring-1 ring-primary/20" : "border-border bg-card hover:bg-accent/50",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Box className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{thing.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{thing.category ?? "Thing"}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
