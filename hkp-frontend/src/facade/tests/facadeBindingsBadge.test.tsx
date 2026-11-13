import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadeBindingsProvider } from "../FacadeBindingsContext";
import { FacadeBindingsBadge } from "../FacadeBindingsBadge";
import { describeValue } from "../FacadeStateView";
import { FacadeStateContext } from "../FacadeStateContext";
import type { FacadeDescriptor } from "../types";

/**
 * The facade's own badge: what runs when it opens, the notices it raises, and
 * its state — the bindings that belong to no widget.
 */

const reveal = vi.fn();
vi.mock("hkp-frontend/src/runtime/ui/revealService", () => ({
  revealService: (...args: unknown[]) => reveal(...args),
}));

vi.mock("../boardServices", () => ({
  findService: () => null,
  processService: () => {},
  canReachService: () => true,
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

const BADGE = "What the facade runs, raises and keeps";

function renderBadge({
  enabled = true,
  values = { meeting: "m-1", draft: "hello" } as Record<string, unknown>,
} = {}) {
  return render(
    <FacadeStateContext.Provider value={{ state: values, setState: () => {} }}>
      <FacadeBindingsProvider facade={facade} boardContext={boardContext} badges={enabled}>
        <FacadeBindingsBadge />
      </FacadeBindingsProvider>
    </FacadeStateContext.Provider>,
  );
}

function openTab(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: BADGE }));
  fireEvent.click(screen.getByRole("tab", { name }));
}

afterEach(() => reveal.mockReset());

describe("the facade's own badge", () => {
  it("is not drawn without the board beside the facade", () => {
    renderBadge({ enabled: false });
    expect(screen.queryByRole("button", { name: BADGE })).toBeNull();
  });

  it("counts what each tab holds", () => {
    renderBadge();
    fireEvent.click(screen.getByRole("button", { name: BADGE }));
    expect(screen.getByRole("tab", { name: /^Actions/ }).textContent).toContain("1");
    expect(screen.getByRole("tab", { name: /^Updates/ }).textContent).toContain("2");
    // "meeting" from the facade, "draft" only from what is held now.
    expect(screen.getByRole("tab", { name: /State/ }).textContent).toContain("2");
  });

  it("lists what runs on open, with where it lives and a way to it", async () => {
    renderBadge();
    openTab(/^Actions/);
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
    renderBadge();
    openTab(/^Updates/);
    const list = screen.getByRole("tabpanel", { name: "Updates" });
    expect(within(list).getByText("reads error")).toBeTruthy();
    expect(within(list).getByText("Raises an error toast saying the value")).toBeTruthy();
    expect(within(list).getByText("Raises a success toast: “Saved”")).toBeTruthy();
  });

  it("shows each state key's value now, who writes it and who reads it", () => {
    renderBadge();
    openTab(/State/);
    const list = screen.getByRole("tabpanel", { name: "State" });
    const meeting = list.querySelector('[data-state-key="meeting"]') as HTMLElement;
    expect(within(meeting).getByText('"m-1"')).toBeTruthy();
    expect(within(meeting).getByText("Starts with the facade's initial state.")).toBeTruthy();
    expect(within(meeting).getByRole("button", { name: "Pick (button)" })).toBeTruthy();
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
