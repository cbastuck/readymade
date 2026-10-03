import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LineChart from "./LineChart";

describe("LineChart sizing", () => {
  let reportSize: ((entries: ResizeObserverEntry[]) => void) | undefined;

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          reportSize = callback;
        }

        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    reportSize = undefined;
  });

  it("does not make a chart permanently zero-width when its tab starts hidden", () => {
    const view = render(
      <LineChart
        series={{
          Glucose: [
            { time: 1, price: 110 },
            { time: 2, price: 118 },
          ],
        }}
        width={600}
      />,
    );
    const container = view.container.firstElementChild as HTMLElement;

    act(() => {
      reportSize?.([
        { contentRect: { width: 0 } } as unknown as ResizeObserverEntry,
      ]);
    });

    expect(container.style.width).toBe("600px");
    expect(container.style.maxWidth).toBe("100%");

    act(() => {
      reportSize?.([
        { contentRect: { width: 420 } } as unknown as ResizeObserverEntry,
      ]);
    });

    expect(container.querySelector("svg")?.getAttribute("width")).toBe("420");
  });

  it("uses the full available width when no fixed width is requested", () => {
    const view = render(
      <LineChart
        series={{
          Weight: [
            { time: 1, price: 78.2 },
            { time: 2, price: 78.1 },
          ],
        }}
      />,
    );
    const container = view.container.firstElementChild as HTMLElement;

    expect(container.style.width).toBe("100%");

    act(() => {
      reportSize?.([
        { contentRect: { width: 840 } } as unknown as ResizeObserverEntry,
      ]);
    });

    expect(container.querySelector("svg")?.getAttribute("width")).toBe("840");
  });

  it("shows the nearest timestamp and actual values while hovering", () => {
    const morning = Date.parse("2026-09-28T08:00:00Z");
    const afternoon = Date.parse("2026-09-28T13:00:00Z");
    const view = render(
      <LineChart
        series={{
          "Blood glucose": [
            { time: morning, price: 110 },
            {
              time: afternoon,
              price: 126,
              context: "Late lunch, short walk, no alcohol.",
            },
          ],
        }}
        unit="mg/dL"
        contextLabel="Daily journal"
        width={600}
      />,
    );
    const svg = view.container.querySelector("svg") as SVGSVGElement;
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 600,
    } as DOMRect);

    fireEvent(
      screen.getByTestId("line-chart-hit-area"),
      new MouseEvent("pointermove", { bubbles: true, clientX: 400 }),
    );

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toContain("Blood glucose");
    expect(tooltip.textContent).toContain("126.00 mg/dL");
    expect(tooltip.textContent).toContain("Daily journal");
    expect(tooltip.textContent).toContain("Late lunch, short walk, no alcohol.");

    fireEvent.pointerLeave(screen.getByTestId("line-chart-hit-area"));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
