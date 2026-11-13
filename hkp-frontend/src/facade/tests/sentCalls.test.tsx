import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import { executeActions } from "../executeActions";
import FacadeRenderer from "../FacadeRenderer";
import { FacadeViewProvider } from "../FacadeViewContext";
import { createSendLog } from "../sentCalls";
import { BADGE_LABEL } from "../panels/BindingsBadge";
import type { FacadeDescriptor, FacadePanel } from "../types";

/**
 * What a widget sent to the board — each configure and process, with the
 * payload as it went out — listed under the binding it went along.
 */

const configured = vi.fn();
const processed = vi.fn();
vi.mock("../boardServices", () => ({
  findService: (_ctx: unknown, uuid: string) =>
    uuid === "greet" || uuid === "level"
      ? { uuid, app: {}, configure: (c: unknown) => configured(uuid, c) }
      : null,
  processService: (_ctx: unknown, uuid: string, payload: unknown) =>
    processed(uuid, payload),
  canReachService: () => true,
  isBuiltInside: () => true,
  whenServiceConnected: async () => {},
}));

vi.mock("hkp-frontend/src/runtime/ui/revealService", () => ({
  revealService: () => {},
}));

const boardContext = {
  scopes: {},
  runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
  services: {
    ui: [
      { uuid: "greet", serviceId: "monitor", serviceName: "Greeter" },
      { uuid: "level", serviceId: "monitor", serviceName: "Level" },
    ],
  },
  runtimeApis: {},
} as unknown as BoardContextState;

beforeEach(() => {
  configured.mockReset();
  processed.mockReset();
});

describe("the send log", () => {
  it("keeps each sender's calls newest first, and only so many", () => {
    const log = createSendLog(3);
    const button = { kind: "widget", panel: "p", path: [0] } as const;
    const other = { kind: "init", index: 0 } as const;
    for (let n = 1; n <= 4; n++) {
      log.record(button, { service: "s", verb: "configure", payload: n });
    }
    log.record(other, { service: "s", verb: "process", payload: "x" });
    expect(log.of(button).map((c) => c.payload)).toEqual([4, 3, 2]);
    expect(log.of(other)).toHaveLength(1);
  });

  it("tells whoever listens, and hands out the same list until it changes", () => {
    const log = createSendLog(3);
    const site = { kind: "init", index: 0 } as const;
    const listener = vi.fn();
    log.subscribe(listener);
    const before = log.of(site);
    expect(log.of(site)).toBe(before);
    log.record(site, { service: "s", verb: "configure", payload: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(log.of(site)).not.toBe(before);
    log.clear();
    expect(log.of(site)).toEqual([]);
  });
});

describe("what executeActions says it sent", () => {
  it("is the payload as it went out, with the action's position", async () => {
    const onSent = vi.fn();
    await executeActions({
      actions: [
        { type: "configure", serviceUuid: "level", configure: { to: "$$input", who: { $state: "name" } } },
        { type: "process", serviceUuid: "greet", payload: { text: "$$input" } },
      ],
      value: "hi",
      state: { name: "Ada" },
      boardContext,
      setState: () => {},
      onSent,
    });
    expect(onSent).toHaveBeenNthCalledWith(1, {
      service: "level",
      verb: "configure",
      payload: { to: "hi", who: "Ada" },
      step: 0,
    });
    expect(onSent).toHaveBeenNthCalledWith(2, {
      service: "greet",
      verb: "process",
      payload: { text: "hi" },
      step: 1,
    });
  });

  it("leaves out a configure that found no service to go to", async () => {
    const onSent = vi.fn();
    await executeActions({
      actions: [{ type: "configure", serviceUuid: "nowhere", configure: { a: 1 } }],
      value: undefined,
      boardContext,
      setState: () => {},
      onSent,
    });
    expect(onSent).not.toHaveBeenCalled();
  });
});

describe("a widget's sends under its bindings", () => {
  const panel = {
    id: "form",
    layout: {
      direction: "column",
      items: [
        {
          type: "button",
          label: "Greet",
          actions: [
            { type: "configure", serviceUuid: "level", configure: { level: 7 } },
            { type: "process", serviceUuid: "greet", payload: { who: "Ada" } },
          ],
        },
        {
          type: "button",
          label: "Quiet",
          actions: [{ type: "configure", serviceUuid: "level", configure: { level: 0 } }],
        },
      ],
    },
  } as unknown as FacadePanel;
  const facade: FacadeDescriptor = { layout: "single", panels: [panel] };

  // The store as FacadeRenderer keeps it, the send log with it, and the badge
  // that opens the editor on a widget.
  function renderFacade() {
    localStorage.setItem("hkp-facade-runtime-sends-board", "true");
    return render(
      <FacadeViewProvider boardName="sends-board">
        <FacadeRenderer
          facade={facade}
          boardContext={boardContext}
          boardName="sends-board"
          runtimeContent={null}
          onFacadeChange={() => {}}
        />
      </FacadeViewProvider>,
    );
  }

  function openEditorOn(site: string) {
    const host = document.querySelector(`[data-facade-site="${site}"]`) as HTMLElement;
    fireEvent.click(within(host).getByRole("button", { name: BADGE_LABEL }));
    return screen.getByRole("tabpanel", { name: "Acts on" });
  }

  function rowOf(list: HTMLElement, verb: string): HTMLElement {
    return within(list).getByText(verb).closest("li") as HTMLElement;
  }

  it("lists each call along the binding it went, as the widget's own", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    renderFacade();
    fireEvent.click(screen.getByRole("button", { name: "Greet" }));
    await vi.waitFor(() => expect(processed).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Quiet" }));
    await vi.waitFor(() => expect(configured).toHaveBeenCalledTimes(2));

    const list = openEditorOn("form/0");
    const configure = rowOf(list, "configure level");
    expect(within(configure).getByText("Recent sends · 1")).toBeTruthy();
    // The last call in view, and again in the list.
    expect(within(configure).getAllByText('{"level":7}')).toHaveLength(2);
    // The other button's configure to the same service is its own.
    expect(within(configure).queryByText('{"level":0}')).toBeNull();

    const process = rowOf(list, "process");
    expect(within(process).getAllByText('{"who":"Ada"}')).toHaveLength(2);
  });

  it("shows a call sent while the editor is open", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    renderFacade();
    const list = openEditorOn("form/1");
    expect(within(rowOf(list, "configure level")).queryByText(/Recent sends/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Quiet" }));
    expect(
      await within(rowOf(list, "configure level")).findByText("Recent sends · 1"),
    ).toBeTruthy();
  });
});
