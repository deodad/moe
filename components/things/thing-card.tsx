import { ArrowUpRight, Box } from "lucide-react";
import type { HistoryEvent, MaintenanceItem, Thing } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ThingCard({
  thing,
  maintenance = [],
  history = [],
  compact = false,
  selected = false,
  onClick,
}: {
  thing: Thing;
  maintenance?: MaintenanceItem[];
  history?: HistoryEvent[];
  compact?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const description = [thing.attributes.year, thing.attributes.make, thing.attributes.model].filter(Boolean).join(" ");
  if (onClick) {
    return (
      <button
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
          selected ? "border-emerald-300 bg-emerald-50/60" : "border-stone-200 bg-white hover:border-stone-300",
        )}
        onClick={onClick}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><Box className="size-4" /></span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-stone-900">{thing.name}</span><span className="mt-0.5 block truncate text-xs text-stone-500">{description || thing.category || "Thing"}</span></span>
        <ArrowUpRight className="size-4 text-stone-400" />
      </button>
    );
  }
  return (
    <Card className={compact ? "rounded-xl" : undefined}>
      <CardContent className={compact ? "p-4" : "p-6"}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xl font-semibold tracking-[-0.025em] text-stone-950">{thing.name}</p>
            <p className="mt-1 text-sm text-stone-500">{description || thing.category || "Maintained thing"}</p>
          </div>
          <span className="rounded-full bg-emerald-50 p-2 text-emerald-800"><ArrowUpRight className="size-4" /></span>
        </div>
        {!compact && thing.carePreferences && (
          <div className="mt-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">Care</p>
            <p className="mt-2 text-sm leading-6 text-stone-700">{thing.carePreferences}</p>
          </div>
        )}
        {!compact && maintenance[0] && (
          <div className="mt-6 border-t border-stone-100 pt-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">Upcoming</p>
            <p className="mt-2 text-sm font-medium text-stone-800">{maintenance[0].title}</p>
          </div>
        )}
        {!compact && history[0] && (
          <div className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">Recent</p>
            <p className="mt-2 text-sm text-stone-700">{history[0].summary} · {new Date(history[0].occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
