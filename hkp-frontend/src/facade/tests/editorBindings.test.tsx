import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadeEditor } from "../editor/FacadeEditor";
import { pathOfSite, siteOfPath } from "../editor/editorUtils";
import { FacadeBindingsProvider } from "../FacadeBindingsContext";
import type { FacadeDescriptor } from "../types";

/**
 * The facade editor shows what the badges show: the facade's own bindings, and
 * the selected widget's, with the same rows.
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

// Only the facade on screen, as it may be while the editor is open.
const setMode = vi.fn();
vi.mock("../FacadeViewContext", () => ({
  useFacadeView: () => ({ showRuntime: false, showFacade: true, setMode }),
}));

const boardContext = {
  scopes: {},
  runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
  services: { ui: [{ uuid: "greet", serviceId: "monitor", serviceName: "Greeter" }] },
  runtimeApis: {},
} as unknown as BoardContextState;

const facade = {
  layout: "single",
  init: [{ type: "process", serviceUuid: "greet", payload: {} }],
  panels: [
    {
      id: "form",
      layout: {
        direction: "column",
        items: [
          { type: "text-input", label: "Your name", actions: [{ type: "set-state", key: "name" }] },
          {
            type: "button",
            label: "Greet",
            actions: [{ type: "process", serviceUuid: "greet", payload: { who: { $state: "name" } } }],
          },
          {
            type: "repeat",
            items: [{ id: 1 }],
            template: { type: "button", label: "{{item.id}}", actions: [{ type: "set-state", key: "pick" }] },
          },
        ],
      },
    },
  ],
} as unknown as FacadeDescriptor;

function renderEditor() {
  return render(
    <FacadeBindingsProvider facade={facade} boardContext={boardContext} badges={false}>
      <FacadeEditor facade={facade} onChange={() => {}} />
    </FacadeBindingsProvider>,
  );
}

const row = (label: RegExp) =>
  screen.getAllByRole("treeitem").find((item) =>
    label.test(item.querySelector(".hkp-editor-tree-label")?.textContent ?? ""),
  )!;

afterEach(() => {
  reveal.mockReset();
  setMode.mockReset();
});

describe("bindings in the facade editor", () => {
  it("opens on the facade itself, with what it runs on open", async () => {
    renderEditor();
    expect(row(/^Facade$/).getAttribute("aria-selected")).toBe("true");
    const facadeSection = screen.getByRole("region", { name: "Facade bindings" });
    expect(within(facadeSection).getByRole("tab", { name: /Runs on open/ })).toBeTruthy();
    expect(within(facadeSection).queryByRole("tab", { name: /State/ })).toBeNull();
    expect(await within(facadeSection).findByText("Browser › Greeter")).toBeTruthy();
  });

  it("shows a selected widget's bindings beside its properties", async () => {
    renderEditor();
    fireEvent.click(row(/Greet$/));
    const section = screen.getByRole("region", { name: "Bindings" });
    expect(within(section).getByText("process")).toBeTruthy();
    expect(await within(section).findByText("Browser › Greeter")).toBeTruthy();
  });

  it("selects the other widget of a state key rather than scrolling to it", () => {
    renderEditor();
    fireEvent.click(row(/Greet$/));
    const section = screen.getByRole("region", { name: "Bindings" });
    fireEvent.click(within(section).getByRole("tab", { name: /Shows from/ }));
    fireEvent.click(within(section).getByRole("button", { name: "Your name (text-input)" }));
    expect(row(/Your name/).getAttribute("aria-selected")).toBe("true");
  });

  it("brings the board on screen before showing a service in it", async () => {
    renderEditor();
    fireEvent.click(row(/Greet$/));
    const section = screen.getByRole("region", { name: "Bindings" });
    await within(section).findByText("Browser › Greeter");
    fireEvent.click(within(section).getByRole("button", { name: "Show in board" }));
    expect(setMode).toHaveBeenCalledWith("split");
    expect(reveal).toHaveBeenCalled();
  });

  it("marks the tree's nodes that bind something", () => {
    renderEditor();
    expect(row(/Greet$/).querySelector(".hkp-editor-tree-binds")).not.toBeNull();
    expect(row(/container/).querySelector(".hkp-editor-tree-binds")).toBeNull();
  });
});

describe("an editor path as a binding site", () => {
  it("names a repeat's template as the site the facade uses, and back", () => {
    const site = siteOfPath(facade, [0, 2, 0]);
    expect(site).toMatchObject({ panel: "form", path: [2, "template"], type: "button" });
    expect(pathOfSite(facade, site!)).toEqual([0, 2, 0]);
  });

  it("finds nothing for a site the facade no longer has", () => {
    expect(
      pathOfSite(facade, { kind: "widget", panel: "gone", path: [0] }),
    ).toBeNull();
  });
});

describe("a repeat template's widget as a list names it", () => {
  it("says what each item shows rather than the template's reference", async () => {
    const { siteLabel } = await import("../panels/BindingRows");
    expect(
      siteLabel({
        kind: "widget",
        panel: "p",
        path: [0, "template"],
        type: "button",
        label: "{{item.title}}",
      }),
    ).toBe("‹title› (button), per item");
  });
});

describe("the facade editor's panes", () => {
  it("can be resized between the tree, the element and the state", () => {
    renderEditor();
    expect(screen.getByRole("separator", { name: "Resize the layout tree" })).toBeTruthy();
    expect(screen.getByRole("separator", { name: "Resize the facade state" })).toBeTruthy();
  });

  it("keeps the state panel at the height it was dragged to", () => {
    renderEditor();
    const handle = screen.getByRole("separator", { name: "Resize the facade state" });
    // jsdom lays nothing out, so the editor offers the room the bounds allow.
    Object.defineProperty(handle.parentElement!, "clientHeight", { value: 600 });
    // Nothing is laid out, so the first step lands on the smallest a pane may
    // be, and the next one grows it from there.
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    const panel = screen.getByRole("region", { name: "Facade state" });
    expect(panel.style.height).toBe("72px");
  });
});
