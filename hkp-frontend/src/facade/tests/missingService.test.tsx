import { describe, expect, it, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";

import { LayoutNode } from "../panels/LayoutNode";
import { widgetServiceUuids } from "../widgetServices";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { LayoutItem } from "../types";

/**
 * A facade naming a service the board does not have.
 *
 * The lookup behind every widget polls until the service it wants turns up,
 * because a browser service may be appended into its scope after the facade is
 * already on screen. Left unbounded, that makes a typo in a uuid look exactly
 * like a service that is a moment late — forever, and in silence, since a
 * widget with nothing to draw draws nothing.
 *
 * So the two cases are pinned apart here: nothing is said while the board may
 * still be assembling itself, and once it can no longer be that, the widget
 * says which uuid it is waiting on, where it sits.
 */

let found: unknown = null;

vi.mock("../boardServices", () => ({
  findService: () => found,
  processService: () => {},
}));

const boardContext = {
  scopes: {},
  services: {},
  runtimes: [],
} as unknown as BoardContextState;

function renderNode(item: LayoutItem) {
  return render(
    <LayoutNode
      item={item}
      boardContext={boardContext}
      panelContext={{ knobValues: {}, onKnobChange: () => {} }}
    />,
  );
}

const widget = {
  type: "text",
  source: { serviceUuid: "take-hourr", path: "error" },
} as unknown as LayoutItem;

afterEach(() => {
  vi.useRealTimers();
  found = null;
});

describe("a widget whose service is not there", () => {
  it("says nothing while the board may still be building it", () => {
    vi.useFakeTimers();
    renderNode(widget);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByText(/no service/)).toBeNull();
  });

  it("names the uuid once it is no longer a board still loading", () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderNode(widget);

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByText(/no service “take-hourr”/)).toBeTruthy();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("take-hourr"));
    warn.mockRestore();
  });

  it("stops saying it if the service arrives late after all", () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    renderNode(widget);

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByText(/no service/)).not.toBeNull();

    // The poll does not end at the deadline: a service appended into its scope
    // by mutation is found by the next slow tick, and the report goes with it.
    found = { uuid: "take-hourr", state: {} };
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByText(/no service/)).toBeNull();
  });
});

describe("the services a widget names", () => {
  it("collects a source, an action and a second reference beside them", () => {
    expect(
      widgetServiceUuids({
        type: "level-meter",
        source: { serviceUuid: "meter" },
        thresholdKnobServiceUuid: "gate",
      } as unknown as LayoutItem).sort(),
    ).toEqual(["gate", "meter"]);
  });

  it("leaves a payload alone — a uuid inside one is a value, not an address", () => {
    expect(
      widgetServiceUuids({
        type: "button",
        action: {
          serviceUuid: "play",
          configure: { serviceUuid: "something-on-another-board" },
        },
      } as unknown as LayoutItem),
    ).toEqual(["play"]);
  });

  it("leaves a container's children to the nodes that render them", () => {
    expect(
      widgetServiceUuids({
        direction: "column",
        items: [{ type: "canvas", serviceUuid: "inner" }],
      } as unknown as LayoutItem),
    ).toEqual([]);
  });
});
