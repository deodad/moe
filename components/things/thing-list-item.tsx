import type { Thing } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ThingListItem({ thing, selected, onClick }: { thing: Thing; selected?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full flex-col border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0",
        selected ? "border-l-2 border-l-primary bg-accent pl-[calc(0.75rem-2px)] font-medium text-accent-foreground" : "hover:bg-muted/60",
      )}
    >
      <span className="truncate">{thing.name}</span>
      <span className="truncate font-mono text-[0.68rem] tracking-wide text-muted-foreground uppercase">{thing.category ?? "Item"}</span>
    </button>
  );
}
