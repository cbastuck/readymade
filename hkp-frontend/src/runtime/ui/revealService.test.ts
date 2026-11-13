import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { revealService, revealTargetAlong } from "./revealService";
import {
  INSPECTOR_REQUEST_TTL_MS,
  onInspectorRequest,
  requestInspector,
} from "hkp-frontend/src/ui-components/service/inspectorRequests";
import type { NestedNavigation } from "./NestedNavigation";
import { onRuntimeExpandRequest } from "hkp-frontend/src/ui-components/runtime-ui/runtimeRequests";

/** Gives an element the size a laid-out one has; jsdom lays nothing out. */
function layOut(element: HTMLElement, laidOut = true) {
  element.getBoundingClientRect = () =>
    ({ width: laidOut ? 200 : 0, height: laidOut ? 80 : 0 }) as DOMRect;
}

/**
 * Bringing a service into view from outside the board's own panels — the
 * overview, the asset view, a facade widget — and opening its inspector.
 */

function fakeNavigation() {
  return {
    openHolding: vi.fn(),
    goTo: vi.fn(),
  } as unknown as NestedNavigation & {
    openHolding: ReturnType<typeof vi.fn>;
    goTo: ReturnType<typeof vi.fn>;
  };
}

describe("revealing a service", () => {
  let frame: HTMLElement;
  beforeEach(() => {
    vi.useFakeTimers();
    frame = document.createElement("div");
    frame.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    frame.remove();
    vi.useRealTimers();
  });

  it("opens every level above a nested service, outermost first, each by what it has to hold", () => {
    const navigation = fakeNavigation();
    revealService(
      {
        uuid: "mailer",
        ancestry: ["route", "inner"],
        hostLabel: (depth) => ["Switch", "Inner"][depth],
      },
      navigation,
    );
    expect(navigation.openHolding.mock.calls).toEqual([
      ["route", "inner", "Switch", 0],
      ["inner", "mailer", "Inner", 1],
    ]);
    expect(navigation.goTo).not.toHaveBeenCalled();
  });

  it("goes back to the board for a top-level one", () => {
    const navigation = fakeNavigation();
    revealService({ uuid: "form", ancestry: [], hostLabel: () => "" }, navigation);
    expect(navigation.goTo).toHaveBeenCalledWith(0);
  });

  it("waits for the frame, then scrolls to it, marks it, and opens its inspector when asked", () => {
    const opened = vi.fn();
    const stop = onInspectorRequest("late", opened);

    revealService(
      { uuid: "late", ancestry: [], hostLabel: () => "" },
      null,
      { inspect: "input" },
    );
    vi.advanceTimersToNextFrame();
    expect(opened).not.toHaveBeenCalled();

    // The frame appears once its level has rendered.
    frame.id = "service-frame-late";
    const card = document.createElement("div");
    card.className = "hkp-service-card";
    const plug = document.createElement("button");
    frame.append(card, plug);
    layOut(frame);
    document.body.appendChild(frame);
    vi.advanceTimersToNextFrame();

    expect(frame.scrollIntoView).toHaveBeenCalled();
    // The card is marked, not the frame holding the plug beside it.
    expect(card.classList.contains("hkp-service-card--revealed")).toBe(true);
    expect(frame.classList.contains("hkp-service-card--revealed")).toBe(false);
    expect(opened).toHaveBeenCalledWith("input");
    stop();
  });
});

describe("revealing a service in a collapsed runtime", () => {
  afterEach(() => vi.useRealTimers());

  it("asks the runtime holding it to expand", () => {
    const expand = vi.fn();
    const stop = onRuntimeExpandRequest("node", expand);
    revealService(
      { uuid: "mailer", ancestry: [], hostLabel: () => "", runtimeId: "node" },
      null,
    );
    expect(expand).toHaveBeenCalledTimes(1);
    stop();
  });

  it("waits for the frame to be laid out before scrolling to it", () => {
    vi.useFakeTimers();
    const frame = document.createElement("div");
    frame.id = "service-frame-folded";
    frame.scrollIntoView = vi.fn();
    layOut(frame, false);
    document.body.appendChild(frame);

    revealService({ uuid: "folded", ancestry: [], hostLabel: () => "" }, null);
    vi.advanceTimersToNextFrame();
    expect(frame.scrollIntoView).not.toHaveBeenCalled();

    // The runtime has expanded.
    layOut(frame);
    vi.advanceTimersToNextFrame();
    expect(frame.scrollIntoView).toHaveBeenCalled();
    frame.remove();
  });
});

describe("asking for a frame's inspector", () => {
  afterEach(() => vi.useRealTimers());

  it("is taken by the frame that mounts for it shortly after", () => {
    requestInspector("soon", "output");
    const opened = vi.fn();
    const stop = onInspectorRequest("soon", opened);
    expect(opened).toHaveBeenCalledWith("output");
    stop();
  });

  it("is dropped once a reveal would have stopped waiting", () => {
    vi.useFakeTimers();
    requestInspector("stale", "output");
    vi.advanceTimersByTime(INSPECTOR_REQUEST_TTL_MS + 1);
    const opened = vi.fn();
    const stop = onInspectorRequest("stale", opened);
    expect(opened).not.toHaveBeenCalled();
    stop();
  });

  it("goes to one frame where two share a uuid", () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = onInspectorRequest("twin", first);
    const stopSecond = onInspectorRequest("twin", second);
    requestInspector("twin", "input");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    stopFirst();
    stopSecond();
  });
});

describe("the service a place in a state belongs to", () => {
  const service = {
    uuid: "site",
    serviceName: "Site",
    state: {
      pipeline: [
        {
          instanceId: "pages",
          serviceId: "sub-service",
          serviceName: "Pages",
          state: {
            pipeline: [
              {
                instanceId: "home",
                serviceId: "static",
                serviceName: "Home",
                state: { body: "hkp-asset://home" },
              },
            ],
          },
        },
      ],
    },
  };

  it("is the innermost entry the path passes through, with the ones above it as hosts", () => {
    const target = revealTargetAlong(service, [
      "pipeline",
      0,
      "state",
      "pipeline",
      0,
      "state",
      "body",
    ]);
    expect(target).toMatchObject({ uuid: "home", ancestry: ["site", "pages"] });
    expect([target.hostLabel(0), target.hostLabel(1)]).toEqual(["Site", "Pages"]);
  });

  it("is the service itself for a path through none", () => {
    expect(revealTargetAlong(service, ["title"])).toMatchObject({
      uuid: "site",
      ancestry: [],
    });
  });
});
