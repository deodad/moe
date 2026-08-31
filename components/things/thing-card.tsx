import { Box } from "lucide-react";
import type { HistoryEvent, MaintenanceItem, Thing } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { shortDate } from "@/lib/utils";

function describe(thing: Thing) {
  return [thing.attributes.year, thing.attributes.make, thing.attributes.model].filter(Boolean).join(" ");
}

export function ThingCard({
  thing,
  maintenance = [],
  history = [],
  compact = false,
}: {
  thing: Thing;
  maintenance?: MaintenanceItem[];
  history?: HistoryEvent[];
  compact?: boolean;
}) {
  const description = describe(thing);

  if (compact) {
    return (
      <Card size="sm">
        <CardContent className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Box className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{thing.name}</p>
            <p className="truncate text-xs text-muted-foreground">{description || thing.category || "Thing"}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle className="text-xl">{thing.name}</CardTitle>
          <CardDescription className="mt-1">{description || thing.category || "Maintained thing"}</CardDescription>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Box className="size-4" />
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {thing.carePreferences && (
          <div>
            <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Care</p>
            <p className="mt-2 text-sm leading-6 text-foreground">{thing.carePreferences}</p>
          </div>
        )}
        {maintenance[0] && (
          <>
            <Separator />
            <div>
              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Upcoming</p>
              <p className="mt-2 text-sm font-medium text-foreground">{maintenance[0].title}</p>
            </div>
          </>
        )}
        {history[0] && (
          <>
            <Separator />
            <div>
              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Recent</p>
              <p className="mt-2 text-sm text-foreground">
                {history[0].summary} · {shortDate(history[0].occurredAt)}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
