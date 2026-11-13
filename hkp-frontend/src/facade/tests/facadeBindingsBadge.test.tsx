import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadeBindingsProvider } from "../FacadeBindingsContext";
import { FACADE_BADGE_LABEL, FacadeBindings } from "../FacadeBindingsBadge";
import { FacadeStateView, describeValue } from "../FacadeStateView";
import { facadeBindings } from "../bindings";
import FacadeRenderer from "../FacadeRenderer";
import { FacadeViewProvider } from "../FacadeViewContext";
import { FacadeStateContext } from "../FacadeStateContext";
import type { FacadeDescriptor } from "../types";

/**
 * The bindings that belong to no widget — what runs when the facade opens, the
 * notices it raises, and its state — and the facade's own badge, which opens
 * the editor on them.
 */

const reveal = vi.fn();
vi.mock("hkp-frontend/src/runtime/ui/revealService", () => ({
  revealService: (...args: unknown[]) => reveal(...args),
}));

vi.mock("../boardServices", () => ({
  findService: () => null,
  processService: () => {},
  canReachService: () => true,
  isBuiltInside: () => true,
  whenServiceConnected: async () => {},
}));

const boardContext = {
  scopes: {},
  runtimes: [{ id: "node", name: "Node", type: "rest" }],
  services: {
    node: [
      { uuid: "poll", serviceId: "sql", serviceName: "Poll" },
      { uuid: "take-hour", serviceId: "sql", serviceName: "Take hour" },
    ],
  },
  runtimeApis: {},
} as unknown as BoardContextState;

const facade = {
  layout: "single",
  state: { meeting: null },
  init: [
    { type: "configure", serviceUuid: "poll", configure: { meeting: { $state: "meeting" } } },
  ],
  notices: [
    { source: { serviceUuid: "take-hour", path: "error" } },
    { source: { serviceUuid: "poll", path: "saved" }, tone: "success", message: "Saved" },
  ],
  panels: [
    {
      id: "dates",
      layout: {
        type: "button",
        label: "Pick",
        actions: [{ type: "set-state", key: "meeting", value: "m-1" }],
      },
    },
  ],
} as unknown as FacadeDescriptor;

const BOARD = "facade-badge-board";

function renderLists(values: Record<string, unknown> = { meeting: "m-1", draft: "hello" }) {
  return render(
    <FacadeStateContext.Provider value={{ state: values, setState: () => {} }}>
      <FacadeBindingsProvider facade={facade} boardContext={boardContext} badges>
        <FacadeBindings tabs={["init", "notices"]} onDone={() => {}} onRevealSite={() => {}} />
        <div role="region" aria-label="state">
          <FacadeStateView index={facadeBindings(facade)} empty="none" />
        </div>
      </FacadeBindingsProvider>
    </FacadeStateContext.Provider>,
  );
}

function renderFacade({ split = true, editable = true } = {}) {
  localStorage.setItem(`hkp-facade-runtime-${BOARD}`, String(split));
  return render(
    <FacadeViewProvider boardName={BOARD} editable={editable}>
      <FacadeRenderer
        facade={facade}
        boardContext={boardContext}
        boardName={BOARD}
        runtimeContent={<div>the runtimes</div>}
      />
    </FacadeViewProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => reveal.mockReset());

describe("the facade's own badge", () => {
  it("is not drawn without the board beside the facade", () => {
    renderFacade({ split: false });
    expect(screen.queryByRole("button", { name: FACADE_BADGE_LABEL })).toBeNull();
  });

  it("is not drawn where the facade cannot be edited, as on a deployed board", () => {
    renderFacade({ editable: false });
    expect(screen.queryByRole("button", { name: FACADE_BADGE_LABEL })).toBeNull();
  });

  it("opens the editor on the facade's state", () => {
    renderFacade();
    fireEvent.click(screen.getByRole("button", { name: FACADE_BADGE_LABEL }));
    const tree = screen.getByRole("tree", { name: "Facade" });
    const state = within(tree)
      .getAllByRole("treeitem")
      .find((item) => item.textContent === "State")!;
    expect(state.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("region", { name: "Facade state" })).toBeTruthy();
  });
});

describe("the facade's own bindings", () => {
  it("counts what each tab holds", () => {
    renderLists();
    expect(screen.getByRole("tab", { name: /^Actions/ }).textContent).toContain("1");
    expect(screen.getByRole("tab", { name: /^Updates/ }).textContent).toContain("2");
  });

  it("lists what runs on open, with where it lives and a way to it", async () => {
    renderLists();
    const list = screen.getByRole("tabpanel", { name: "Actions" });
    expect(within(list).getByText("configure meeting")).toBeTruthy();
    expect(await within(list).findByText("Node › Poll")).toBeTruthy();
    expect(within(list).getByText("uses facade state")).toBeTruthy();

    fireEvent.click(within(list).getByRole("button", { name: "Show in board" }));
    expect(reveal).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: "poll", runtimeId: "node" }),
      null,
      { inspect: undefined },
    );
  });

  it("lists each notice's source and what it raises", () => {
    renderLists();
    fireEvent.click(screen.getByRole("tab", { name: /^Updates/ }));
    const list = screen.getByRole("tabpanel", { name: "Updates" });
    expect(within(list).getByText("reads error")).toBeTruthy();
    expect(within(list).getByText("Raises an error toast saying the value")).toBeTruthy();
    expect(within(list).getByText("Raises a success toast: “Saved”")).toBeTruthy();
  });

  it("shows each state key's value now, who writes it and who reads it", () => {
    renderLists();
    const list = screen.getByRole("region", { name: "state" });
    const meeting = list.querySelector('[data-state-key="meeting"]') as HTMLElement;
    expect(within(meeting).getByText('"m-1"')).toBeTruthy();
    expect(within(meeting).getByText("Starts with the facade's initial state.")).toBeTruthy();
    expect(within(meeting).getByText(/Pick \(button\)/)).toBeTruthy();
    expect(within(meeting).getByText(/runs on open/)).toBeTruthy();

    const draft = list.querySelector('[data-state-key="draft"]') as HTMLElement;
    expect(within(draft).getByText("Nothing in the facade writes it.")).toBeTruthy();
  });
});

describe("a state value as the State tab says it", () => {
  it("says when there is none, and keeps a long one short", () => {
    expect(describeValue(undefined)).toBe("not set");
    expect(describeValue({ a: 1 })).toBe('{"a":1}');
    expect(describeValue("x".repeat(400)).length).toBe(160);
  });
});
