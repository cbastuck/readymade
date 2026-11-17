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

  it("switches between slices of the same shape", () => {
    reported.value = {
      labels: ["a", "b"],
      slice: 0,
      slices: [
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
    renderHeatmap({ showValues: true, sliceLabel: "Head" });

    expect(screen.getByTestId("heatmap-cell-1-1").textContent).toBe(".20");
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(screen.getByRole("tablist").getAttribute("aria-label")).toBe("Head");

    fireEvent.click(tabs[1]);
    expect(screen.getByTestId("heatmap-cell-1-1").textContent).toBe(".90");
  });

  it("reads nothing into keys it does not know", () => {
    // What a service calls its matrix is the board's to point at with `path`.
    reported.value = { pattern: [[1.0]], pieces: ["a"], head: 3 };
    renderHeatmap({ placeholder: "Nothing yet." });
    expect(screen.getByTestId("heatmap-placeholder").textContent).toBe("Nothing yet.");
  });
});
