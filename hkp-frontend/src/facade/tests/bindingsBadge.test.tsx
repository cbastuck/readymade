import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import FacadeRenderer from "../FacadeRenderer";
import { FacadeViewProvider } from "../FacadeViewContext";
import { BADGE_LABEL } from "../panels/BindingsBadge";
import type { FacadeDescriptor } from "../types";

/**
 * The badge on a facade widget, in the board + facade view: it opens the
 * facade editor on that widget, on what the widget binds — and the editor and
 * the facade go on pointing at the same widget.
 */

vi.mock("hkp-frontend/src/runtime/ui/revealService", () => ({
  revealService: () => {},
}));

vi.mock("../boardServices", () => ({
  findService: (_ctx: unknown, uuid: string) =>
    uuid === "greet" ? { uuid, app: {}, configure: () => {} } : null,
  processService: () => {},
  canReachService: () => true,
  isBuiltInside: () => true,
  whenServiceConnected: async () => {},
}));

const BOARD = "badge-board";

const boardContext = {
  scopes: {},
  runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
  services: {
    ui: [{ uuid: "greet", serviceId: "monitor", serviceName: "Greeter" }],
  },
  runtimeApis: {},
} as unknown as BoardContextState;

const facade = {
  layout: "single",
  panels: [
    {
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
            direction: "row",
            items: [
              {
                type: "button",
                label: "Greet",
                actions: [
                  { type: "process", serviceUuid: "greet", payload: { who: { $state: "name" } } },
                ],
              },
            ],
          },
          { type: "text", label: "Greeting", source: { serviceUuid: "greet", path: "text" } },
          { type: "text", placeholder: "A note that binds nothing" },
        ],
      },
    },
  ],
} as unknown as FacadeDescriptor;

function renderFacade({ split = true, editable = true } = {}) {
  localStorage.setItem(`hkp-facade-runtime-${BOARD}`, String(split));
  return render(
    <FacadeViewProvider boardName={BOARD} editable={editable}>
      <FacadeRenderer
        facade={facade}
        boardContext={boardContext}
        boardName={BOARD}
        runtimeContent={<div>the runtimes</div>}
        onFacadeChange={() => {}}
      />
    </FacadeViewProvider>,
  );
}

function host(site: string): HTMLElement {
  return document.querySelector(`[data-facade-site="${site}"]`) as HTMLElement;
}

function badgeOf(site: string): HTMLElement {
  return within(host(site)).getByRole("button", { name: BADGE_LABEL });
}

const treeRow = (label: RegExp) =>
  screen.getAllByRole("treeitem").find((item) =>
    label.test(item.querySelector(".hkp-editor-tree-label")?.textContent ?? ""),
  )!;

const editor = () => screen.queryByRole("region", { name: "Selected element" });

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});

describe("a facade widget's binding badge", () => {
  it("is on every widget that binds something, and on nothing else", () => {
    renderFacade();
    expect(screen.getAllByRole("button", { name: BADGE_LABEL })).toHaveLength(3);
    expect(within(host("form/3")).queryByRole("button", { name: BADGE_LABEL })).toBeNull();
  });

  it("is not drawn without the board beside the facade", () => {
    renderFacade({ split: false });
    expect(screen.queryByRole("button", { name: BADGE_LABEL })).toBeNull();
  });

  it("is not drawn where the facade cannot be edited, as on a deployed board", () => {
    renderFacade({ editable: false });
    expect(screen.queryByRole("button", { name: BADGE_LABEL })).toBeNull();
  });

  it("opens the editor on its widget, on what the widget acts on", async () => {
    renderFacade();
    expect(editor()).toBeNull();
    fireEvent.click(badgeOf("form/1.0"));

    expect(treeRow(/Greet$/).getAttribute("aria-selected")).toBe("true");
    const list = screen.getByRole("tabpanel", { name: "Acts on" });
    expect(within(list).getByText("process")).toBeTruthy();
    expect(await within(list).findByText("Browser › Greeter")).toBeTruthy();
  });

  it("opens on what updates a widget that acts on nothing", () => {
    renderFacade();
    fireEvent.click(badgeOf("form/2"));
    expect(treeRow(/Greeting$/).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel", { name: "Updated by" })).toBeTruthy();
  });

  it("marks its widget on the facade, which the editor opening beside it moved", async () => {
    renderFacade();
    fireEvent.click(badgeOf("form/1.0"));
    await waitFor(() =>
      expect(host("form/1.0").classList.contains("hkp-facade-widget--revealed")).toBe(true),
    );
  });

  it("unfolds the tree to a widget whose container was folded", () => {
    renderFacade();
    fireEvent.click(badgeOf("form/0"));
    // Fold the row holding the button, then ask for the button.
    const row = treeRow(/container\s+row/);
    fireEvent.click(row.querySelector(".hkp-editor-tree-toggle")!);
    expect(screen.queryAllByRole("treeitem").some((item) => /Greet$/.test(item.textContent ?? ""))).toBe(false);

    fireEvent.click(badgeOf("form/1.0"));
    expect(treeRow(/Greet$/).getAttribute("aria-selected")).toBe("true");
  });

  it("marks a widget on the facade when it is selected in the tree", async () => {
    renderFacade();
    fireEvent.click(badgeOf("form/1.0"));
    fireEvent.click(treeRow(/Your name/));
    await waitFor(() =>
      expect(host("form/0").classList.contains("hkp-facade-widget--revealed")).toBe(true),
    );
  });
});
