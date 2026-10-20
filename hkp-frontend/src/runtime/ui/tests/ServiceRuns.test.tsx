import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ServiceRuns, {
  describeCaller,
  describeEvent,
  ServiceRunsContext,
  ServiceRunsStore,
} from "../ServiceRuns";
import { LogEntry } from "../../../types";

const entry = (over: Partial<LogEntry>): LogEntry => ({
  runId: "run-1",
  ts: "2026-10-21T16:00:00.000Z",
  runtimeId: "club",
  serviceUuid: "take-hour",
  level: "info",
  event: "sql.run",
  ...over,
});

describe("a service's recent runs", () => {
  it("gathers a run's entries into one, with who began it", () => {
    const store = new ServiceRunsStore();
    store.add(entry({ event: "service.process", level: "debug", caller: "s|ana" }));
    store.add(entry({ data: { changes: 1 }, caller: "s|ana" }), { name: "Ana", role: "member" });
    store.add(entry({ event: "service.processed", level: "debug", durationMs: 3, caller: "s|ana" }));

    const [run] = store.get("take-hour");
    expect(run).toMatchObject({ runId: "run-1", durationMs: 3, caller: { name: "Ana" } });
    expect(run.events.map(describeEvent)).toEqual(["1 row changed"]);
    expect(describeCaller(run)).toBe("Ana");
  });

  it("keeps the last few runs of each service apart", () => {
    const store = new ServiceRunsStore();
    for (let i = 0; i < 9; i++) store.add(entry({ runId: `run-${i}` }));
    store.add(entry({ serviceUuid: "day-grid", event: "sql.query", data: { count: 45 } }));

    expect(store.get("take-hour").map((r) => r.runId)).toEqual(
      ["run-3", "run-4", "run-5", "run-6", "run-7", "run-8"],
    );
    expect(store.get("day-grid")[0].events.map(describeEvent)).toEqual(["45 rows"]);
  });

  it("says who acted without naming anyone it was not told about", () => {
    const store = new ServiceRunsStore();
    store.add(entry({ runId: "a" }));
    store.add(entry({ runId: "b", caller: "s|x" }));
    store.add(entry({ runId: "c", caller: "s|sam" }), { role: "owner" });
    expect(store.get("take-hour").map(describeCaller)).toEqual(["the board", "a member", "you"]);
  });

  it("draws the runs as they arrive, newest first", () => {
    const store = new ServiceRunsStore();
    render(
      <ServiceRunsContext.Provider value={store}>
        <ServiceRuns serviceUuid="take-hour" />
      </ServiceRunsContext.Provider>,
    );
    expect(screen.queryByLabelText("Recent runs")).toBeNull();

    act(() => {
      store.add(entry({ runId: "first", data: { changes: 0 }, caller: "s|sam" }), { name: "Sam", role: "owner" });
      store.add(entry({ runId: "second", data: { changes: 1 }, caller: "s|ana" }), { name: "Ana", role: "member" });
    });

    const rows = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(rows[0]).toContain("Ana");
    expect(rows[0]).toContain("1 row changed");
    expect(rows[1]).toContain("Sam");
    expect(rows[1]).toContain("changed nothing");
  });

  it("shows nothing where nobody is sent the log", () => {
    const { container } = render(<ServiceRuns serviceUuid="take-hour" />);
    expect(container.innerHTML).toBe("");
  });
});
