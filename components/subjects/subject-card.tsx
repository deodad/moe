import type { HistoryEvent, MaintenanceItem, Subject } from "@/lib/types";
import { shortDate } from "@/lib/utils";

function describe(subject: Subject) {
  return [subject.attributes.year, subject.attributes.make, subject.attributes.model].filter(Boolean).join(" ");
}

/** Label column is 128px everywhere a field/value row appears (here and the chat activity record), so they align as one system. */
function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[128px_1fr] items-baseline gap-4 border-t border-border px-4 py-2.5 text-sm">
      <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{label}</span>
      <div className="leading-6 text-foreground">{children}</div>
    </div>
  );
}

export function SubjectCard({
  subject,
  maintenance = [],
  history = [],
  compact = false,
}: {
  subject: Subject;
  maintenance?: MaintenanceItem[];
  history?: HistoryEvent[];
  compact?: boolean;
}) {
  const description = describe(subject);

  if (compact) {
    return (
      <div className="flex items-center gap-3 border border-border bg-card px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{subject.name}</p>
          <p className="truncate font-mono text-xs tracking-wide text-muted-foreground uppercase">{description || subject.category || "Item"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card">
      <div className="flex items-baseline justify-between gap-3 border-b border-line-strong px-4 py-3">
        <h2 className="text-lg font-semibold tracking-[-0.01em]">{subject.name}</h2>
        <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{description || subject.category || "Item"}</span>
      </div>
      {subject.carePreferences && <SpecRow label="Care">{subject.carePreferences}</SpecRow>}
      {maintenance[0] && <SpecRow label="Upcoming">{maintenance[0].title}</SpecRow>}
      {history[0] && <SpecRow label="Recent">{history[0].summary} · {shortDate(history[0].occurredAt)}</SpecRow>}
    </div>
  );
}
