import type { HistoryEvent, MaintenanceItem, Subject } from "@/lib/types";
import { shortDate } from "@/lib/utils";
import { friendlyDueDate } from "@/lib/maintenance-schedule";

export function SubjectContext({
  subject,
  maintenance,
  history,
}: {
  subject: Subject;
  maintenance: MaintenanceItem[];
  history: HistoryEvent[];
}) {
  const attributes = Object.entries(subject.attributes);

  return (
    <div className="divide-y divide-border border-y border-line-strong bg-card lg:border">
      <section className="px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[0.68rem] tracking-wide text-muted-foreground uppercase">Subject context</p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">{subject.name}</h2>
          </div>
          <span className="border border-border px-2 py-1 font-mono text-[0.68rem] tracking-wide text-muted-foreground uppercase">
            {subject.category ?? "Item"}
          </span>
        </div>
      </section>

      {attributes.length > 0 && (
        <section className="px-4 py-3">
          <p className="mb-2 font-mono text-[0.68rem] tracking-wide text-muted-foreground uppercase">Known details</p>
          <dl className="grid grid-cols-[minmax(72px,auto)_1fr] gap-x-4 gap-y-1.5 text-sm">
            {attributes.map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="font-mono text-xs text-muted-foreground capitalize">{key.replaceAll("_", " ")}</dt>
                <dd className="min-w-0 truncate text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {subject.carePreferences && (
        <section className="px-4 py-3">
          <p className="mb-2 font-mono text-[0.68rem] tracking-wide text-muted-foreground uppercase">How you care for it</p>
          <p className="text-sm leading-6">{subject.carePreferences}</p>
        </section>
      )}

      <section className="px-4 py-3">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="font-mono text-[0.68rem] tracking-wide text-muted-foreground uppercase">Attention</p>
          <span className="font-mono text-xs text-muted-foreground">{maintenance.length}</span>
        </div>
        {maintenance.length ? (
          <ul className="space-y-2">
            {maintenance.slice(0, 3).map((item) => (
              <li key={item.id} className="border-l-2 border-warning pl-3 text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="mt-0.5 font-mono text-[0.68rem] tracking-wide text-muted-foreground uppercase">
                  {item.dueDate ? friendlyDueDate(item.dueDate) : item.timing.replaceAll("_", " ")}
                </p>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>}
      </section>

      <section className="px-4 py-3">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="font-mono text-[0.68rem] tracking-wide text-muted-foreground uppercase">Recent history</p>
          <span className="font-mono text-xs text-muted-foreground">{history.length}</span>
        </div>
        {history.length ? (
          <ol className="space-y-2">
            {history.slice(0, 4).map((event) => (
              <li key={event.id} className="grid grid-cols-[1fr_auto] gap-3 text-sm">
                <span>{event.summary}</span>
                <time className="font-mono text-xs text-muted-foreground">{shortDate(event.occurredAt)}</time>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-muted-foreground">No recorded history yet.</p>}
      </section>
    </div>
  );
}
