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
  it("opens on its panels, and lists what it runs on open under Actions and Updates", async () => {
    renderEditor();
    expect(row(/^Panels$/).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(row(/^Actions and Updates$/));
    const facadeSection = screen.getByRole("region", { name: "Actions and updates" });
    expect(within(facadeSection).getByRole("tab", { name: /^Actions/ })).toBeTruthy();
    expect(within(facadeSection).queryByRole("tab", { name: /State/ })).toBeNull();
    expect(await within(facadeSection).findByText("Browser › Greeter")).toBeTruthy();
  });

  it("shows a selected widget's properties, and its bindings under tabs beside them", async () => {
    renderEditor();
    fireEvent.click(row(/Greet$/));
    const section = screen.getByRole("region", { name: "Selected element" });
    const tabs = within(section).getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["Properties", "Acts on2", "Updated by0"]);
    expect(within(section).getByRole("tabpanel", { name: "Properties" })).toBeTruthy();
    expect(within(section).getByText("label")).toBeTruthy();

    fireEvent.click(within(section).getByRole("tab", { name: /Acts on/ }));
    const list = within(section).getByRole("tabpanel", { name: "Acts on" });
    expect(within(list).getByText("process")).toBeTruthy();
    expect(await within(list).findByText("Browser › Greeter")).toBeTruthy();
  });

  it("stays on the chosen tab as another element is selected", () => {
    renderEditor();
    fireEvent.click(row(/Greet$/));
    fireEvent.click(screen.getByRole("tab", { name: /Acts on/ }));
    fireEvent.click(row(/Your name/));
    expect(screen.getByRole("tabpanel", { name: "Acts on" })).toBeTruthy();
    expect(screen.getByText("writes facade state")).toBeTruthy();
  });

  it("selects the other widget of a state key rather than scrolling to it", () => {
    renderEditor();
    fireEvent.click(row(/Greet$/));
    const section = screen.getByRole("region", { name: "Selected element" });
    fireEvent.click(within(section).getByRole("tab", { name: /Acts on/ }));
    fireEvent.click(within(section).getByRole("button", { name: "Your name (text-input)" }));
    expect(row(/Your name/).getAttribute("aria-selected")).toBe("true");
  });

  it("brings the board on screen before showing a service in it", async () => {
    renderEditor();
    fireEvent.click(row(/Greet$/));
    const section = screen.getByRole("region", { name: "Selected element" });
    fireEvent.click(within(section).getByRole("tab", { name: /Acts on/ }));
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

describe("the facade editor's tree", () => {
  it("lists the panels, the state, and the actions and updates at its root", () => {
    renderEditor();
    const roots = screen
      .getAllByRole("treeitem")
      .filter((item) => item.classList.contains("hkp-editor-tree-root"))
      .map((item) => item.textContent?.replace(/[▾▸]/g, "").trim());
    expect(roots).toEqual(["Panels", "State", "Actions and Updates"]);
  });

  it("shows a panel's own properties, without its layout", () => {
    renderEditor();
    fireEvent.click(row(/^panel/));
    const section = screen.getByRole("region", { name: "Panel" });
    expect(within(section).getByText("id")).toBeTruthy();
    expect(within(section).queryByText("layout")).toBeNull();
  });

  it("shows the facade's own settings under Panels, without what has items of its own", () => {
    renderEditor();
    const section = screen.getByRole("region", { name: "Facade settings" });
    expect(within(section).getByText("layout")).toBeTruthy();
    expect(within(section).queryByText("init")).toBeNull();
    expect(within(section).queryByText("panels")).toBeNull();
  });

  it("shows the state in the detail pane when State is selected", () => {
    renderEditor();
    fireEvent.click(row(/^State$/));
    expect(screen.getByRole("region", { name: "Facade state" })).toBeTruthy();
  });

  it("can be resized between the tree and the selected element", () => {
    renderEditor();
    expect(screen.getByRole("separator", { name: "Resize the layout tree" })).toBeTruthy();
    expect(screen.queryByRole("separator", { name: "Resize the facade state" })).toBeNull();
  });
});

describe("editing in the facade editor", () => {
  it("writes a panel's edited title back into the facade, keeping its layout", () => {
    let current = facade;
    render(
      <FacadeBindingsProvider facade={facade} boardContext={boardContext} badges={false}>
        <FacadeEditor facade={facade} onChange={(updated) => (current = updated)} />
      </FacadeBindingsProvider>,
    );
    fireEvent.click(row(/^panel/));
    const section = screen.getByRole("region", { name: "Panel" });
    const idRow = within(section).getByText("id").closest("tr")!;
    fireEvent.click(idRow.querySelectorAll("td")[1]);
    const input = idRow.querySelector("input")!;
    fireEvent.change(input, { target: { value: "entry" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(current.panels[0].id).toBe("entry");
    expect(current.panels[0].layout).toBe(facade.panels[0].layout);
  });
});

describe("a state binding in the editor", () => {
  it("says what the key holds now, so state stays in view beside a widget", async () => {
    const { FacadeStateContext } = await import("../FacadeStateContext");
    render(
      <FacadeStateContext.Provider value={{ state: { name: "Ada" }, setState: () => {} }}>
        <FacadeBindingsProvider facade={facade} boardContext={boardContext} badges={false}>
          <FacadeEditor facade={facade} onChange={() => {}} />
        </FacadeBindingsProvider>
      </FacadeStateContext.Provider>,
    );
    fireEvent.click(row(/Greet$/));
    fireEvent.click(screen.getByRole("tab", { name: /Acts on/ }));
    const list = screen.getByRole("tabpanel", { name: "Acts on" });
    expect(within(list).getByText('"Ada"')).toBeTruthy();
  });
});
