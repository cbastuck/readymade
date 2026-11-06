import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The running indicator, in two parts: the header is tinted for exactly as
 * long as the service runs, and a bar sweeps once along its lower edge when a
 * run starts.
 *
 * Runs of one service may overlap — a clock can start the next bar before the
 * last has quite finished — so the tint lasts until every run that started
 * has finished, not until the first one does. Runs are told apart by the id
 * their pair of notifications carries (runtime/serviceState): the end of a run
 * that began before anything listened is one nobody heard begin, and is left
 * alone rather than taken for the end of the run under way. A runtime that
 * sends no id has its runs counted instead.
 *
 * The sweep marks that a run began — one crossing, however long the run takes,
 * and a fresh one for every run, also when the last is still crossing. A run
 * that is over at once still shows its whole crossing; the tint is what says
 * a longer one is still going.
 *
 * A crossing is short so that services run one after another in time — the
 * beats of a rhythm — sweep one after another rather than several at once.
 *
 * Driven by a timer rather than by the animation's own events: the frame that
 * hears a service run may be hidden (a block use shows a bar in its place), and
 * a hidden element runs no animation to report on.
 */
export const SWEEP_MS = 400;

export type SweepState = {
  /** The service is running: its header is tinted. */
  running: boolean;
  /** The bar is crossing. */
  sweeping: boolean;
  /** Which run's crossing it is; a new one restarts it. */
  run: number;
};

export function useProcessingSweep() {
  const [state, setState] = useState<SweepState>({
    running: false,
    sweeping: false,
    run: 0,
  });
  const sweepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The runs under way: by id where the runtime gives one, else counted.
  const open = useRef(new Set<number>());
  const uncounted = useRef(0);

  const cancelSweep = () => {
    if (sweepTimer.current !== null) {
      clearTimeout(sweepTimer.current);
      sweepTimer.current = null;
    }
  };

  const start = useCallback((call?: number) => {
    if (call === undefined) {
      uncounted.current += 1;
    } else {
      open.current.add(call);
    }
    cancelSweep();
    setState((prev) => ({ running: true, sweeping: true, run: prev.run + 1 }));
    sweepTimer.current = setTimeout(() => {
      sweepTimer.current = null;
      setState((prev) => ({ ...prev, sweeping: false }));
    }, SWEEP_MS);
  }, []);

  const finish = useCallback((call?: number) => {
    if (call === undefined) {
      uncounted.current = Math.max(0, uncounted.current - 1);
    } else if (!open.current.delete(call)) {
      return;
    }
    const running = open.current.size + uncounted.current > 0;
    setState((prev) => ({ ...prev, running }));
  }, []);

  useEffect(() => cancelSweep, []);

  return { ...state, start, finish };
}

/**
 * The bar itself: one crossing, started afresh for every run. In the theme's
 * accent unless told otherwise — the mobile canvas has its own.
 */
export function ProcessingSweep({ run, color }: { run: number; color?: string }) {
  return (
    <span
      key={run}
      aria-hidden
      className="hkp-processing-sweep"
      style={{
        animationDuration: `${SWEEP_MS}ms`,
        ...(color ? { background: color } : {}),
      }}
    />
  );
}
