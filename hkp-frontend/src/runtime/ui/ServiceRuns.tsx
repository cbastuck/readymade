import { createContext, useContext, useSyncExternalStore } from "react";

import { LogEntry } from "hkp-frontend/src/types";

/**
 * What a service did lately, as its board's log tells it: each run that
 * reached it — when, who began it, what it did, how long it took.
 *
 * A deployed board keeps its log at the coordinator, which sends each entry
 * to the owner's open views as it is written. This is where those entries are
 * gathered per service, so a panel can show the runs that passed through it:
 * the part of a board that happens while its owner is not the one acting — a
 * member booking from a phone — becomes something they can watch, service by
 * service, without reading a log.
 *
 * Only the owner is sent the log, so only the owner's view has any runs.
 */

/** Who began a run, as the board's list calls them. */
export type RunCaller = { name?: string; role: "owner" | "member" };

export type ServiceRun = {
  runId: string;
  /** When the run first reached the service. */
  ts: string;
  /** Whether a person began it; absent for the board's own work. */
  person: boolean;
  caller?: RunCaller;
  /** What the service said it did, newest last. */
  events: { event: string; level: LogEntry["level"]; data?: unknown }[];
  durationMs?: number;
};

/** How many runs a service keeps on screen. */
const KEEP = 6;

export class ServiceRunsStore {
  private runs = new Map<string, ServiceRun[]>();
  private listeners = new Set<() => void>();
  private static readonly none: ServiceRun[] = [];

  add(entry: LogEntry, caller?: RunCaller): void {
    if (!entry.serviceUuid) return;
    const list = this.runs.get(entry.serviceUuid) ?? [];
    const index = list.findIndex((run) => run.runId === entry.runId);
    const run: ServiceRun =
      index >= 0
        ? { ...list[index], events: [...list[index].events] }
        : {
            runId: entry.runId,
            ts: entry.ts,
            person: !!entry.caller,
            events: [],
          };
    if (caller) run.caller = caller;
    if (entry.event === "service.processed") {
      run.durationMs = entry.durationMs;
    } else if (entry.event !== "service.process") {
      run.events.push({ event: entry.event, level: entry.level, data: entry.data });
    }
    const next =
      index >= 0
        ? list.map((existing, i) => (i === index ? run : existing))
        : [...list, run].slice(-KEEP);
    this.runs.set(entry.serviceUuid, next);
    this.listeners.forEach((listener) => listener());
  }

  get(serviceUuid: string): ServiceRun[] {
    return this.runs.get(serviceUuid) ?? ServiceRunsStore.none;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

export const ServiceRunsContext = createContext<ServiceRunsStore | null>(null);

const count = (n: unknown, one: string, many: string) =>
  typeof n === "number" ? `${n} ${n === 1 ? one : many}` : undefined;

/** What one thing a service said reads as, in a few words. */
export function describeEvent(event: ServiceRun["events"][number]): string {
  const data = (event.data ?? {}) as Record<string, unknown>;
  switch (event.event) {
    case "sql.run":
      return data.changes === 0
        ? "changed nothing"
        : (count(data.changes, "row changed", "rows changed") ?? "ran");
    case "sql.query":
      return count(data.count, "row", "rows") ?? "queried";
    case "pipeline.stopped":
      return "stopped here";
    case "service.failed":
      return typeof data.message === "string" ? data.message : "failed";
    default:
      return event.event;
  }
}

/** Who began a run, for the person reading the panel — its owner. */
export function describeCaller(run: ServiceRun): string {
  if (!run.person) return "the board";
  if (run.caller?.name) return run.caller.name;
  if (run.caller?.role === "owner") return "you";
  return "a member";
}

function clock(ts: string): string {
  const date = new Date(ts);
  return Number.isNaN(date.getTime())
    ? ts
    : date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
}

/** The runs that reached a service, newest first; nothing when there are none. */
export default function ServiceRuns({ serviceUuid }: { serviceUuid: string }) {
  const store = useContext(ServiceRunsContext);
  const runs = useSyncExternalStore(
    store?.subscribe ?? noSubscription,
    () => store?.get(serviceUuid) ?? noRuns,
  );
  if (!runs.length) return null;
  return (
    <section
      aria-label="Recent runs"
      className="hkp-service-runs"
      style={{
        borderTop: "1px solid hsl(var(--border))",
        padding: "6px 10px 8px",
        textAlign: "left",
        fontSize: 11,
        lineHeight: 1.5,
        color: "hsl(var(--muted-foreground))",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 2,
        }}
      >
        Runs
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {[...runs].reverse().map((run) => {
          const failed = run.events.some((e) => e.level === "error");
          return (
            <li
              key={run.runId}
              data-run={run.runId}
              style={{
                display: "flex",
                gap: 8,
                fontVariantNumeric: "tabular-nums",
                color: failed ? "hsl(var(--destructive))" : undefined,
              }}
            >
              <span>{clock(run.ts)}</span>
              <span style={{ color: "hsl(var(--foreground))", fontWeight: 500 }}>
                {describeCaller(run)}
              </span>
              <span style={{ flex: 1 }}>
                {run.events.map(describeEvent).join(", ") || "ran"}
              </span>
              {run.durationMs !== undefined && <span>{run.durationMs} ms</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const noRuns: ServiceRun[] = [];
const noSubscription = () => () => {};
