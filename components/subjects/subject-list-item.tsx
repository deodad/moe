import type { Subject } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SubjectListItem({ subject, selected, onClick }: { subject: Subject; selected?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full flex-col border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0",
        selected ? "border-l-2 border-l-primary bg-accent pl-[calc(0.75rem-2px)] font-medium text-accent-foreground" : "hover:bg-muted/60",
      )}
    >
      <span className="truncate">{subject.name}</span>
      <span className="truncate font-mono text-[0.68rem] tracking-wide text-muted-foreground uppercase">{subject.category ?? "Item"}</span>
    </button>
  );
}
