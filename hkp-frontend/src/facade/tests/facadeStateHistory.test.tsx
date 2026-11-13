import { useCallback, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { BindingSite } from "../bindings";
import { facadeBindings } from "../bindings";
import { executeActions } from "../executeActions";
import {
  FacadeStateContext,
  StateWrite,
  recordWrite,
} from "../FacadeStateContext";
import { FacadeStateView } from "../FacadeStateView";
import { GenericPanel } from "../panels/GenericPanel";
import type { FacadeDescriptor, FacadePanel } from "../types";

/**
 * What was written to facade state, when, and by which widget — the state read
 * as something that happened rather than only as where it is.
 */

vi.mock("../boardServices", () => ({
  findService: () => null,
  processService: () => {},
  canReachService: () => true,
}));

const boardContext = {
  scopes: {},
  runtimes: [],
  services: {},
  runtimeApis: {},
} as unknown as BoardContextState;

describe("recording a write", () => {
  it("keeps the newest first, and only so many per key", () => {
    let history: Record<string, StateWrite[]> = {};
    for (let n = 1; n <= 4; n++) {
      history = recordWrite(history, "k", { at: n, value: n }, 3);
    }
    history = recordWrite(history, "other", { at: 9, value: "x" }, 3);
    expect(history.k.map((w) => w.value)).toEqual([4, 3, 2]);
    expect(history.other).toHaveLength(1);
  });
});

describe("who wrote a value", () => {
  const panel = {
    id: "dates",
    layout: {
      direction: "column",
      items: [
        { type: "text", placeholder: "Pick one" },
        {
          type: "button",
          label: "Pick",
          actions: [{ type: "set-state", key: "meeting", value: "m-1" }],
        },
      ],
    },
  } as unknown as FacadePanel;
  const facade: FacadeDescriptor = { layout: "single", panels: [panel] };

  /** The store as FacadeRenderer keeps it: state, and the writes to it. */
  function Facade() {
    const [state, setRaw] = useState<Record<string, unknown>>({});
    const [history, setHistory] = useState<Record<string, StateWrite[]>>({});
    const setState = useCallback(
      (key: string, value: unknown, writer?: BindingSite) => {
        setRaw((prev) => ({ ...prev, [key]: value }));
        setHistory((prev) =>
          recordWrite(prev, key, { at: Date.now(), value, writer }, 10),
        );
      },
      [],
    );
    return (
      <FacadeStateContext.Provider value={{ state, setState, history }}>
        <GenericPanel panel={panel} boardContext={boardContext} showTitle={false} />
        <div role="region" aria-label="state">
          <FacadeStateView index={facadeBindings(facade)} empty="none" />
        </div>
      </FacadeStateContext.Provider>
    );
  }

  it("is the widget whose action wrote it, named as the facade names it", async () => {
    render(<Facade />);
    fireEvent.click(screen.getByRole("button", { name: "Pick" }));

    const view = screen.getByRole("region", { name: "state" });
    const row = view.querySelector('[data-state-key="meeting"]') as HTMLElement;
    expect(within(row).getByText("Recent writes · 1")).toBeTruthy();
    expect(within(row).getByText(/by Pick \(button\)/)).toBeTruthy();
    // The value now, and the write that put it there.
    expect(within(row).getAllByText('"m-1"')).toHaveLength(2);
  });
});

describe("an init action's write", () => {
  it("says which of the actions wrote it", async () => {
    const setState = vi.fn();
    await executeActions({
      actions: [
        { type: "show-panel", panel: "dates" },
        { type: "set-state", key: "meeting", value: "m-1" },
      ],
      value: undefined,
      boardContext,
      setState,
    });
    expect(setState).toHaveBeenCalledWith("meeting", "m-1", 1);
  });

  it("counts from the actions a widget wrote, not the steps a shorthand adds", async () => {
    const setState = vi.fn();
    await executeActions({
      confirm: "Sure?",
      ask: async () => true,
      actions: [{ type: "set-state", key: "k", value: 1 }],
      value: undefined,
      boardContext,
      setState,
    });
    expect(setState).toHaveBeenCalledWith("k", 1, 0);
  });
});
