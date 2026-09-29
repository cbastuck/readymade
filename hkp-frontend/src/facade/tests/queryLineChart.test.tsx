import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { LayoutItem } from "../types";
import { LayoutNode } from "../panels/LayoutNode";

let notified: unknown;

vi.mock("../panels/renderers/StatusIndicatorRenderer", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../panels/renderers/StatusIndicatorRenderer")
  >()),
  useNotificationValue: () => notified,
}));

vi.mock("hkp-frontend/src/ui-components/LineChart", () => ({
  default: (props: unknown) => <pre data-testid="chart-props">{JSON.stringify(props)}</pre>,
}));

const boardContext = {
  scopes: {},
  services: {},
  runtimes: [],
} as unknown as BoardContextState;

const chart = {
  type: "line-chart",
  source: { serviceUuid: "history", path: "rows" },
  seriesField: "measurement.name",
  valueField: "reading",
  timeField: "observedAt",
  contextField: "journal",
  contextLabel: "Daily journal",
  symbols: ["Systolic", "Diastolic"],
  unit: "mmHg",
  emptyLabel: "No blood pressure entries yet.",
} as LayoutItem;

function show() {
  return render(
    <LayoutNode
      item={chart}
      boardContext={boardContext}
      panelContext={{ knobValues: {}, onKnobChange: () => {} }}
    />,
  );
}

function props(): any {
  return JSON.parse(screen.getByTestId("chart-props").textContent ?? "{}");
}

describe("a line chart backed by a query", () => {
  it("maps and filters a complete history array", async () => {
    notified = [
      {
        measurement: { name: "Systolic" },
        reading: 124,
        observedAt: "2026-09-27T19:00:00.000Z",
        journal: "Long walk after lunch.",
      },
      {
        measurement: { name: "Diastolic" },
        reading: 78,
        observedAt: "2026-09-27T19:00:00.000Z",
      },
      {
        measurement: { name: "Blood glucose" },
        reading: 112,
        observedAt: "2026-09-27T08:00:00.000Z",
      },
    ];
    show();

    await waitFor(() => {
      expect(Object.keys(props().series)).toEqual(["Systolic", "Diastolic"]);
    });
    expect(props().series.Systolic[0].price).toBe(124);
    expect(props().series.Systolic[0].context).toBe("Long walk after lunch.");
    expect(props().unit).toBe("mmHg");
    expect(props().contextLabel).toBe("Daily journal");
    expect(props().emptyLabel).toBe("No blood pressure entries yet.");
  });

  it("replaces old history when a query reports a new array", async () => {
    notified = [
      {
        measurement: { name: "Systolic" },
        reading: 124,
        observedAt: "2026-09-27T19:00:00.000Z",
      },
    ];
    const view = show();
    await waitFor(() => expect(props().series.Systolic).toHaveLength(1));

    notified = [
      {
        measurement: { name: "Systolic" },
        reading: 119,
        observedAt: "2026-09-28T19:00:00.000Z",
      },
      {
        measurement: { name: "Systolic" },
        reading: 121,
        observedAt: "2026-09-29T19:00:00.000Z",
      },
    ];
    view.rerender(
      <LayoutNode
        item={chart}
        boardContext={boardContext}
        panelContext={{ knobValues: {}, onKnobChange: () => {} }}
      />,
    );

    await waitFor(() => expect(props().series.Systolic).toHaveLength(2));
    expect(props().series.Systolic.map((point: any) => point.price)).toEqual([
      119,
      121,
    ]);
  });

  it("retains the original one-live-point-at-a-time contract", async () => {
    const live = {
      type: "line-chart",
      source: { serviceUuid: "ticks" },
    } as LayoutItem;
    notified = { symbol: "AAPL", price: 201, time: "2026-09-29T07:00:00Z" };
    const view = render(
      <LayoutNode
        item={live}
        boardContext={boardContext}
        panelContext={{ knobValues: {}, onKnobChange: () => {} }}
      />,
    );
    await waitFor(() => expect(props().series.AAPL).toHaveLength(1));

    notified = { symbol: "AAPL", price: 202, time: "2026-09-29T07:01:00Z" };
    view.rerender(
      <LayoutNode
        item={live}
        boardContext={boardContext}
        panelContext={{ knobValues: {}, onKnobChange: () => {} }}
      />,
    );
    await waitFor(() => expect(props().series.AAPL).toHaveLength(2));
  });
});
