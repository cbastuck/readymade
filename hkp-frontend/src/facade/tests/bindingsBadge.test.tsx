import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadeBindingsProvider } from "../FacadeBindingsContext";
import { GenericPanel } from "../panels/GenericPanel";
import type { FacadeDescriptor, FacadePanel } from "../types";

/**
 * The badge on a facade widget, in the board + facade view: what the widget
 * sends to and shows from, and the way from each binding to the board.
 */

const reveal = vi.fn();
vi.mock("hkp-frontend/src/runtime/ui/revealService", () => ({
  revealService: (...args: unknown[]) => reveal(...args),
}));

vi.mock("../boardServices", () => ({
  findService: (_ctx: unknown, uuid: string) =>
    uuid === "greet" ? { uuid, app: {}, configure: () => {} } : null,
  processService: () => {},
  canReachService: () => true,
}));

const boardContext = {
  scopes: {},
  runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
  services: {
    ui: [{ uuid: "greet", serviceId: "monitor", serviceName: "Greeter" }],
  },
  runtimeApis: {},
} as unknown as BoardContextState;

const panel = {
  id: "form",
  layout: {
    direction: "column",
    items: [
      {
        type: "text-input",
        label: "Your name",
        actions: [{ type: "set-state", key: "name" }],
      },
      {
        type: "button",
        label: "Greet",
        actions: [
          { type: "process", serviceUuid: "greet", payload: { who: { $state: "name" } } },
        ],
      },
      { type: "text", placeholder: "A note that binds nothing" },
    ],
  },
} as unknown as FacadePanel;

const facade: FacadeDescriptor = { layout: "single", panels: [panel] };

const BADGE = "What this sends to and shows from";

function renderPanel(enabled = true) {
  return render(
    <FacadeBindingsProvider
      facade={facade}
      boardContext={boardContext}
      enabled={enabled}
    >
      <GenericPanel panel={panel} boardContext={boardContext} showTitle={false} />
    </FacadeBindingsProvider>,
  );
}

function badgeOf(site: string): HTMLElement {
  const host = document.querySelector(`[data-facade-site="${site}"]`) as HTMLElement;
  return within(host).getByRole("button", { name: BADGE });
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  reveal.mockReset();
});

describe("a facade widget's binding badge", () => {
  it("is on every widget that binds something, and on nothing else", () => {
    renderPanel();
    expect(screen.getAllByRole("button", { name: BADGE })).toHaveLength(2);
    expect(
      within(
        document.querySelector('[data-facade-site="form/2"]') as HTMLElement,
      ).queryByRole("button", { name: BADGE }),
    ).toBeNull();
  });

  it("is not drawn without the board beside the facade", () => {
    renderPanel(false);
    expect(screen.queryByRole("button", { name: BADGE })).toBeNull();
  });

  it("lists what a widget sends to, with where the service lives", async () => {
    renderPanel();
    fireEvent.click(badgeOf("form/1"));

    const list = screen.getByRole("tabpanel", { name: "Sends to" });
    expect(within(list).getByText("process")).toBeTruthy();
    expect(await within(list).findByText("Greeter")).toBeTruthy();
    expect(within(list).getByText("Browser › Greeter")).toBeTruthy();
  });

  it("lists the state a widget shows from, with the widgets writing it", () => {
    renderPanel();
    fireEvent.click(badgeOf("form/1"));
    fireEvent.click(screen.getByRole("tab", { name: /Shows from/ }));

    const list = screen.getByRole("tabpanel", { name: "Shows from" });
    expect(within(list).getByText("reads facade state")).toBeTruthy();
    expect(within(list).getByText(/Written by/)).toBeTruthy();
    expect(
      within(list).getByRole("button", { name: "Your name (text-input)" }),
    ).toBeTruthy();
  });

  it("says when nothing reads what a widget writes", () => {
    renderPanel();
    fireEvent.click(badgeOf("form/0"));
    // The button reads "name", so the input's write has a reader.
    expect(screen.getByRole("button", { name: "Greet (button)" })).toBeTruthy();
  });

  it("shows the service in the board, or inspects its input", async () => {
    renderPanel();
    fireEvent.click(badgeOf("form/1"));
    await screen.findByText("Greeter");
    fireEvent.click(screen.getByRole("button", { name: "Show in board" }));
    expect(reveal).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: "greet", ancestry: [] }),
      null,
      { inspect: undefined },
    );

    fireEvent.click(badgeOf("form/1"));
    await screen.findByText("Greeter");
    fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
    expect(reveal).toHaveBeenLastCalledWith(
      expect.objectContaining({ uuid: "greet" }),
      null,
      { inspect: "input" },
    );
  });

  it("brings the widget writing a state key into view", async () => {
    renderPanel();
    fireEvent.click(badgeOf("form/1"));
    fireEvent.click(screen.getByRole("tab", { name: /Shows from/ }));
    fireEvent.click(screen.getByRole("button", { name: "Your name (text-input)" }));

    const writer = document.querySelector('[data-facade-site="form/0"]') as HTMLElement;
    await waitFor(() =>
      expect(writer.classList.contains("hkp-facade-widget--revealed")).toBe(true),
    );
  });
});
