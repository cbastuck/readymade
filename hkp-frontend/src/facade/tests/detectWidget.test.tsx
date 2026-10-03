import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { LayoutNode } from "../panels/LayoutNode";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { LayoutItem } from "../types";

/**
 * The detect widget: what a Detect service sees, drawn from the `found` it
 * reports on every frame — the picture the board decided on, not the camera's.
 */

const reported: { source?: { serviceUuid: string; path?: string }; value?: unknown } = {};

vi.mock("../panels/renderers/StatusIndicatorRenderer", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../panels/renderers/StatusIndicatorRenderer")
  >()),
  useNotificationValue: (_ctx: unknown, source: { serviceUuid: string; path?: string }) => {
    reported.source = source;
    return reported.value;
  },
}));

vi.mock("../boardServices", () => ({
  findService: () => null,
  processService: () => {},
}));

const boardContext = { scopes: {}, services: {}, runtimes: [] } as unknown as BoardContextState;

function renderWidget(width?: number) {
  return render(
    <LayoutNode
      item={{ type: "detect", serviceUuid: "detect-svc", width } as unknown as LayoutItem}
      boardContext={boardContext}
      panelContext={{ knobValues: {}, onKnobChange: () => {} }}
    />,
  );
}

describe("the detect widget", () => {
  it("reads what the service found", () => {
    reported.value = undefined;
    renderWidget();
    expect(reported.source).toEqual({ serviceUuid: "detect-svc", path: "found" });
    expect(screen.getByText("Waiting for the first frame…")).toBeTruthy();
  });

  it("draws the frame at the widget's width, its height following the frame", () => {
    reported.value = {
      faces: [{ score: 0.9, box: { x: 10, y: 10, width: 20, height: 20 }, keypoints: [] }],
      frame: { width: 640, height: 480 },
      image: null,
    };
    const { container } = renderWidget(200);
    const canvas = container.querySelector("canvas")!;
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(150);
  });
});
