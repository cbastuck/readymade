import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { SWEEP_MS, useProcessingSweep } from "../processingSweep";

/**
 * The running indicator: the tint lasts exactly as long as the run, and the bar
 * crosses once when a run begins — a whole crossing however short or long the
 * run, and a fresh one for every run.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the running indicator", () => {
  it("tints from the start of a run to its end", () => {
    const { result } = renderHook(() => useProcessingSweep());
    expect(result.current.running).toBe(false);
    act(() => result.current.start());
    expect(result.current.running).toBe(true);
    act(() => vi.advanceTimersByTime(5 * SWEEP_MS));
    expect(result.current.running).toBe(true);
    act(() => result.current.finish());
    expect(result.current.running).toBe(false);
  });

  it("stays tinted while a run that overlaps an earlier one goes on", () => {
    // A clock starting the next bar a little before the last one has finished.
    const { result } = renderHook(() => useProcessingSweep());
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(18));
    act(() => result.current.finish());
    expect(result.current.running).toBe(true);
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.finish());
    expect(result.current.running).toBe(false);
  });

  it("leaves alone the end of a run it never heard begin", () => {
    // Put on screen in the middle of run 1: it hears run 2 begin, then run 1
    // end — which must not end run 2.
    const { result } = renderHook(() => useProcessingSweep());
    act(() => result.current.start(2));
    act(() => result.current.finish(1));
    expect(result.current.running).toBe(true);
    act(() => result.current.finish(2));
    expect(result.current.running).toBe(false);
  });

  it("tells overlapping runs apart by their ids", () => {
    const { result } = renderHook(() => useProcessingSweep());
    act(() => result.current.start(1));
    act(() => result.current.start(2));
    act(() => result.current.finish(1));
    expect(result.current.running).toBe(true);
    act(() => result.current.finish(2));
    expect(result.current.running).toBe(false);
  });

  it("crosses once, however long the run", () => {
    const { result } = renderHook(() => useProcessingSweep());
    act(() => result.current.start());
    expect(result.current.sweeping).toBe(true);
    act(() => vi.advanceTimersByTime(SWEEP_MS - 1));
    expect(result.current.sweeping).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.sweeping).toBe(false);
    // Still running: the tint says so, the bar does not cross again.
    expect(result.current.running).toBe(true);
  });

  it("finishes the crossing of a run that was over at once", () => {
    const { result } = renderHook(() => useProcessingSweep());
    act(() => result.current.start());
    act(() => result.current.finish());
    expect(result.current.running).toBe(false);
    expect(result.current.sweeping).toBe(true);
    act(() => vi.advanceTimersByTime(SWEEP_MS));
    expect(result.current.sweeping).toBe(false);
  });

  it("starts a fresh crossing for a new run, also while the last one crosses", () => {
    const { result } = renderHook(() => useProcessingSweep());
    act(() => result.current.start());
    const first = result.current.run;
    act(() => vi.advanceTimersByTime(SWEEP_MS / 2));
    act(() => result.current.start());
    expect(result.current.run).toBe(first + 1);

    // The first crossing's end does not cut the second one short.
    act(() => vi.advanceTimersByTime(SWEEP_MS / 2));
    expect(result.current.sweeping).toBe(true);
    act(() => vi.advanceTimersByTime(SWEEP_MS / 2));
    expect(result.current.sweeping).toBe(false);
  });
});
