import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAppModeState, useTwoFingerHold } from "../appMode";
import { HISTORY_KEY as DETAIL_HISTORY_KEY } from "../MobileFacadeView";

/**
 * App mode: the facade on the whole screen, left again with the system's back
 * gesture or a two-finger hold — and from under any details opened on top.
 */

beforeEach(() => {
  window.history.replaceState({ router: "kept" }, "");
});

describe("app mode and the history", () => {
  it("is entered with an entry of its own, and left by going back", async () => {
    const { result } = renderHook(() => useAppModeState());
    const before = window.history.length;

    act(() => result.current.enter());

    expect(result.current.active).toBe(true);
    expect(window.history.length).toBe(before + 1);
    expect(window.history.state.router).toBe("kept");

    act(() => window.history.back());

    await waitFor(() => expect(result.current.active).toBe(false));
  });

  it("leaves from under the details opened on top of it", async () => {
    const { result } = renderHook(() => useAppModeState());
    act(() => result.current.enter());
    // What the facade does when a detail opens: the state carried on.
    window.history.pushState(
      { ...window.history.state, [DETAIL_HISTORY_KEY]: { opened: ["d"] } },
      "",
    );
    window.history.pushState(
      { ...window.history.state, [DETAIL_HISTORY_KEY]: { opened: ["d", "e"] } },
      "",
    );

    act(() => result.current.exit());

    await waitFor(() => expect(result.current.active).toBe(false));
    expect(window.history.state.router).toBe("kept");
    expect(window.history.state[DETAIL_HISTORY_KEY]).toBeUndefined();
  });

  it("does not carry a detail opened before it was entered", () => {
    window.history.pushState(
      { ...window.history.state, [DETAIL_HISTORY_KEY]: { opened: ["d"] } },
      "",
    );
    const { result } = renderHook(() => useAppModeState());

    act(() => result.current.enter());

    expect(window.history.state[DETAIL_HISTORY_KEY]).toBeUndefined();
  });

  it("takes no entry another session marked for its own", async () => {
    const first = renderHook(() => useAppModeState());
    act(() => first.result.current.enter());
    first.unmount();
    window.history.pushState({}, "");
    const { result } = renderHook(() => useAppModeState());

    act(() => window.history.back());

    await waitFor(() => expect(window.history.state.hkpAppMode).toBeTruthy());
    expect(result.current.active).toBe(false);
  });
});

describe("the two-finger hold", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function Surface({ onHold }: { onHold: () => void }) {
    const ref = useRef<HTMLDivElement | null>(null);
    useTwoFingerHold(ref, onHold, true);
    return <div ref={ref} data-testid="surface" />;
  }

  const two = [
    { clientX: 100, clientY: 100 },
    { clientX: 200, clientY: 100 },
  ];

  it("fires once two fingers have rested a moment", () => {
    const onHold = vi.fn();
    const { getByTestId } = render(<Surface onHold={onHold} />);

    fireEvent.touchStart(getByTestId("surface"), { touches: two });
    vi.advanceTimersByTime(800);

    expect(onHold).toHaveBeenCalledTimes(1);
  });

  it("is no hold with one finger, a lift or a pinch", () => {
    const onHold = vi.fn();
    const { getByTestId } = render(<Surface onHold={onHold} />);
    const surface = getByTestId("surface");

    fireEvent.touchStart(surface, { touches: [two[0]] });
    vi.advanceTimersByTime(800);

    fireEvent.touchStart(surface, { touches: two });
    fireEvent.touchEnd(surface, { touches: [two[0]] });
    vi.advanceTimersByTime(800);

    fireEvent.touchStart(surface, { touches: two });
    fireEvent.touchMove(surface, {
      touches: [two[0], { clientX: 260, clientY: 100 }],
    });
    vi.advanceTimersByTime(800);

    expect(onHold).not.toHaveBeenCalled();
  });
});
