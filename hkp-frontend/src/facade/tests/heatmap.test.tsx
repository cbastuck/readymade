import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { LayoutNode } from "../panels/LayoutNode";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { LayoutItem } from "../types";

const reported: { value?: unknown; labels?: unknown } = {};

vi.mock("../panels/renderers/StatusIndicatorRenderer", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../panels/renderers/StatusIndicatorRenderer")
  >()),
  useNotificationValue: (_ctx: unknown, source?: { serviceUuid: string; path?: string }) => {
    if (!source) {
      return undefined;
    }
    return source.path === "pieces" ? reported.labels : reported.value;
  },
}));

vi.mock("../boardServices", () => ({
  findService: () => null,
  processService: () => {},
}));

const boardContext = { scopes: {}, services: {}, runtimes: [] } as unknown as BoardContextState;

function renderHeatmap(extra: Record<string, unknown> = {}) {
  return render(
    <LayoutNode
      item={
        {
          type: "heatmap",
          source: { serviceUuid: "unembed-svc", path: "attention" },
          label: "Attention",
          ...extra,
        } as unknown as LayoutItem
      }
      boardContext={boardContext}
      panelContext={{ knobValues: {}, onKnobChange: () => {} }}
    />,
  );
}

describe("the heatmap widget", () => {
  it("shows its placeholder before a matrix arrives", () => {
    reported.value = undefined;
    renderHeatmap({ placeholder: "Nothing yet." });
    expect(screen.getByTestId("heatmap-placeholder").textContent).toBe("Nothing yet.");
  });

  it("draws a 2D matrix with labels and reports the hovered cell", () => {
    reported.value = [
      [1.0, 0.0],
      [0.35, 0.65],
    ];
    reported.labels = ["red", "orange"];
    renderHeatmap({
      labelsSource: { serviceUuid: "tok-svc", path: "pieces" },
      showValues: true,
    });

    expect(screen.getByTestId("heatmap-cell-1-0").textContent).toBe(".35");
    expect(screen.getByTestId("heatmap-cell-1-1").textContent).toBe(".65");

    fireEvent.mouseEnter(screen.getByTestId("heatmap-cell-1-0"));
    expect(screen.getByTestId("heatmap-readout").textContent).toContain(
      '"orange" → "red": 0.3500',
    );
  });

  it("switches slices when given a 3D patterns array", () => {
    reported.value = {
      layer: 2,
      head: 0,
      mask: "causal",
      pieces: ["a", "b"],
      patterns: [
        [
          [1.0, 0.0],
          [0.8, 0.2],
        ],
        [
          [1.0, 0.0],
          [0.1, 0.9],
        ],
      ],
    };
    renderHeatmap({ showValues: true });

    expect(screen.getByTestId("heatmap-cell-1-1").textContent).toBe(".20");
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);

    fireEvent.click(tabs[1]);
    expect(screen.getByTestId("heatmap-cell-1-1").textContent).toBe(".90");
  });
});
