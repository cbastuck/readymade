import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import FacadeRenderer from "../FacadeRenderer";
import MobileFacadeView from "hkp-frontend/src/views/playground/mobile/MobileFacadeView";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import { detailChain, isDetail, rootMasterOf } from "../details";
import type { FacadeDescriptor, FacadePanel } from "../types";

/**
 * Master and detail panels.
 *
 * What is pinned here is that the relation changes nothing where the panels
 * fit side by side, and on a phone puts the detail in place of its master
 * rather than below it — with the way back being both the bar it draws and the
 * system's own back gesture.
 */

vi.mock("../boardServices", () => ({
  findService: () => null,
  processService: () => {},
}));

const boardContext = {
  scopes: {},
  services: {},
  runtimes: [],
} as unknown as BoardContextState;

const panel = (
  id: string,
  text: string,
  extra: Partial<FacadePanel> = {},
): FacadePanel => ({
  id,
  title: id,
  layout: {
    direction: "column",
    items: [{ type: "text", placeholder: text }],
  },
  ...extra,
});

const facade = {
  layout: "columns",
  panels: [
    {
      ...panel("stories", "the stories"),
      layout: {
        direction: "column",
        items: [
          { type: "text", placeholder: "the stories" },
          {
            type: "button",
            label: "Comments",
            actions: [{ type: "show-panel", panel: "discussion" }],
          },
        ],
      },
    },
    panel("discussion", "the discussion", { detailOf: "stories" }),
  ],
} as unknown as FacadeDescriptor;

/** Whether a node is on screen: hidden by display or, under a detail, by visibility. */
function onScreen(el: HTMLElement): boolean {
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    if (node.style.display === "none" || node.style.visibility === "hidden") {
      return false;
    }
  }
  return true;
}

afterEach(() => {
  window.history.replaceState(null, "");
});

describe("resolving details", () => {
  const panels = [
    panel("list", "l"),
    panel("item", "i", { detailOf: "list" }),
    panel("part", "p", { detailOf: "item" }),
    panel("orphan", "o", { detailOf: "gone" }),
    panel("self", "s", { detailOf: "self" }),
    panel("a", "a", { detailOf: "b" }),
    panel("b", "b", { detailOf: "a" }),
  ];

  it("steps back through a chain to the panel it was opened from", () => {
    expect(detailChain(panels, "part")).toEqual(["item", "part"]);
    expect(rootMasterOf(panels, "part")).toBe("list");
    expect(rootMasterOf(panels, "list")).toBe("list");
  });

  it("treats a detail without a master to come back to as a panel", () => {
    expect(isDetail(panels, "list")).toBe(false);
    expect(isDetail(panels, "orphan")).toBe(false);
    expect(isDetail(panels, "self")).toBe(false);
    // Each other's detail: neither has a master to open over.
    expect(isDetail(panels, "a")).toBe(false);
    expect(isDetail(panels, "b")).toBe(false);
  });
});

describe("a detail on a phone", () => {
  const show = () =>
    render(
      <MobileFacadeView
        facade={facade}
        boardContext={boardContext}
        boardName="details-board"
      />,
    );

  it("is not stacked under its master", () => {
    show();
    expect(onScreen(screen.getByText("the stories"))).toBe(true);
    expect(onScreen(screen.getByText("the discussion"))).toBe(false);
  });

  it("opens in place of its master, and the bar takes it back", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Comments" }));
    await waitFor(() =>
      expect(onScreen(screen.getByText("the discussion"))).toBe(true),
    );
    // Still mounted, so the list is where it was left.
    expect(onScreen(screen.getByText("the stories"))).toBe(false);
    expect(window.history.state?.hkpFacadeDetail?.opened).toEqual([
      "discussion",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Back to stories" }));
    await waitFor(() =>
      expect(onScreen(screen.getByText("the stories"))).toBe(true),
    );
    expect(onScreen(screen.getByText("the discussion"))).toBe(false);
  });

  it("closes on the system's back gesture", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Comments" }));
    await waitFor(() =>
      expect(onScreen(screen.getByText("the discussion"))).toBe(true),
    );
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });
    expect(onScreen(screen.getByText("the stories"))).toBe(true);
    expect(onScreen(screen.getByText("the discussion"))).toBe(false);
  });
});

describe("a detail on the desktop", () => {
  it("sits beside its master, and showing it changes nothing", async () => {
    render(
      <FacadeRenderer
        facade={facade}
        boardContext={boardContext}
        boardName="details-board"
        runtimeContent={null}
      />,
    );
    expect(onScreen(screen.getByText("the stories"))).toBe(true);
    expect(onScreen(screen.getByText("the discussion"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Comments" }));
    await waitFor(() =>
      expect(onScreen(screen.getByText("the stories"))).toBe(true),
    );
    expect(onScreen(screen.getByText("the discussion"))).toBe(true);
    expect(window.history.state?.hkpFacadeDetail).toBeUndefined();
  });

  it("chooses the tab a shown panel is on", async () => {
    render(
      <FacadeRenderer
        facade={{
          ...facade,
          panels: [
            facade.panels[0],
            panel("discussion", "the discussion"),
          ],
          tabs: [
            { id: "read", title: "Read", panels: ["stories"] },
            { id: "talk", title: "Talk", panels: ["discussion"] },
          ],
        }}
        boardContext={boardContext}
        boardName="details-board"
        runtimeContent={null}
      />,
    );
    expect(onScreen(screen.getByText("the discussion"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Comments" }));
    await waitFor(() =>
      expect(onScreen(screen.getByText("the discussion"))).toBe(true),
    );
  });
});
