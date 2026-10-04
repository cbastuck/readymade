import { describe, expect, it } from "vitest";

import board from "../../../../boards/health-log-demo-board.json";
import type { LayoutItem, LineChartWidget } from "../types";

function findWidgets<T extends { type: string }>(
  item: LayoutItem,
  type: string,
): T[] {
  if ("items" in item && (!("type" in item) || item.type !== "repeat")) {
    return item.items.flatMap((child) => findWidgets<T>(child as LayoutItem, type));
  }
  return "type" in item && item.type === type ? [item as T] : [];
}

describe("the private health log demo board", () => {
  it("keeps the post-entry integration as a visible nested pipeline", () => {
    expect(board.services.health.map((service) => service.uuid)).toEqual([
      "add-value",
      "add-blood-pressure",
      "save-journal",
      "after-entry",
      "delete-entry",
      "fake-measurements",
      "fake-journal",
      "read-history",
    ]);
    expect(board.services.health[3]).toMatchObject({
      serviceId: "sub-service",
      state: {
        pipeline: [
          {
            uuid: "entry-event",
            serviceId: "monitor",
            serviceName: "Entry event",
          },
        ],
      },
    });
  });

  it("gives every new entry a generated identity and timestamp", () => {
    const inputs = findWidgets<any>(
      board.facade.panels[0].layout as LayoutItem,
      "text-input",
    );
    expect(inputs).toHaveLength(4);
    for (const input of inputs) {
      expect(input.actions[0].payload.eventId).toEqual({ $uuid: true });
      expect(input.actions[0].payload.observedAt).toEqual({ $now: true });
    }
  });

  it("draws three mapped query-backed charts, including paired blood pressure", () => {
    const charts = findWidgets<LineChartWidget>(
      board.facade.panels[1].layout as LayoutItem,
      "line-chart",
    );
    expect(charts).toHaveLength(3);
    expect(
      charts.every(
        (chart) =>
          chart.source.serviceUuid === "read-history" &&
          chart.source.path === "rows" &&
          chart.seriesField === "series" &&
          chart.valueField === "value" &&
          chart.timeField === "observedAt" &&
          chart.contextField === "journal" &&
          chart.contextLabel === "Daily journal",
      ),
    ).toBe(true);
    expect(charts[1].symbols).toEqual(["Systolic", "Diastolic"]);
  });

  it("stores one multiline journal per day and forwards it through the hook", () => {
    const journal = findWidgets<any>(
      board.facade.panels[0].layout as LayoutItem,
      "text-input",
    ).find((input) => input.label === "Today's journal");
    expect(journal).toMatchObject({
      multiline: true,
      rows: 4,
      actions: [
        {
          serviceUuid: "save-journal",
          payload: {
            operation: "save-journal",
            journal: "$$input",
          },
        },
      ],
    });
    expect(board.services.health[2].state.statement).toContain(
      "ON CONFLICT(day) DO UPDATE",
    );
    expect(board.services.health[7].state.statement).toContain(
      "LEFT JOIN health_journal",
    );
  });

  it("deletes by event id so a paired measurement stays one event", () => {
    const table = findWidgets<any>(
      board.facade.panels[2].layout as LayoutItem,
      "data-table",
    )[0];
    expect(table).toMatchObject({
      rowKey: "eventId",
      selectionState: "selectedEvents",
    });
    expect(board.services.health[4].state.statement).toContain(
      "event_id IN (SELECT value FROM json_each($eventIds))",
    );
  });

  it("generates a fake history on request, past the new-entry hook", () => {
    const button = findWidgets<any>(
      board.facade.panels[2].layout as LayoutItem,
      "button",
    ).find((candidate) => candidate.label === "Generate fake data");
    // Asked first: it writes several hundred rows into a person's own log.
    expect(button.confirm).toBeTruthy();
    expect(button.actions).toEqual([
      {
        type: "process",
        serviceUuid: "fake-measurements",
        payload: { operation: "generate-fake-data" },
      },
    ]);

    // Entered after the hook, so generated rows are not announced downstream
    // as measurements a person took.
    const order = board.services.health.map((service) => service.uuid);
    expect(order.indexOf("fake-measurements")).toBeGreaterThan(
      order.indexOf("after-entry"),
    );
    // Every writer sees every request, so each generator answers only its own.
    for (const uuid of ["fake-measurements", "fake-journal"]) {
      const service = board.services.health.find((svc) => svc.uuid === uuid)!;
      expect(service.state.statement).toContain(
        "$operation = 'generate-fake-data'",
      );
      expect(service.state.emit).toBe("input");
    }
  });
});
