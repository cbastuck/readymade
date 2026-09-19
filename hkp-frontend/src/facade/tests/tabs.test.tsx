import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import FacadeRenderer from "../FacadeRenderer";
import MobileFacadeView from "hkp-frontend/src/views/playground/mobile/MobileFacadeView";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import { currentFace, defaultFaceId, resolveFaces } from "../tabs";
import type { FacadeDescriptor } from "../types";

/**
 * Tabs over a facade's panels.
 *
 * What is pinned here is the two decisions that make tabs a *view* over panels
 * rather than a second place to keep them: a panel no tab claims is still on
 * screen, and a tab that is switched away from is hidden rather than thrown
 * away — so what a person half-did on it is still half-done when they come
 * back.
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

const panel = (id: string, text: string) => ({
  id,
  title: id,
  layout: { direction: "column" as const, items: [{ type: "text" as const, placeholder: text }] },
});

const facade = {
  layout: "single",
  panels: [panel("read", "the articles"), panel("feeds", "the feed list"), panel("status", "always here")],
  tabs: [
    { id: "reading", title: "Read", panels: ["read"] },
    { id: "admin", title: "Feeds", panels: ["feeds"] },
  ],
  defaultTab: "reading",
} as unknown as FacadeDescriptor;

describe("resolving a facade's faces", () => {
  it("leaves a facade without tabs as one face holding every panel", () => {
    const { shared, faces } = resolveFaces({ ...facade, tabs: undefined });
    expect(shared).toHaveLength(3);
    expect(faces).toHaveLength(0);
    expect(defaultFaceId({ ...facade, tabs: undefined })).toBeNull();
  });

  it("shares the panels no tab claims", () => {
    const { shared, faces } = resolveFaces(facade);
    expect(shared.map((p) => p.id)).toEqual(["status"]);
    expect(faces.map((f) => f.panels.map((p) => p.id))).toEqual([["read"], ["feeds"]]);
  });

  it("ignores a tab's reference to a panel the facade no longer has", () => {
    const { faces } = resolveFaces({
      ...facade,
      tabs: [{ id: "reading", title: "Read", panels: ["read", "gone"] }],
    });
    expect(faces[0].panels.map((p) => p.id)).toEqual(["read"]);
  });

  it("opens on the named tab, and on the first one when it names none", () => {
    expect(defaultFaceId(facade)).toBe("reading");
    expect(defaultFaceId({ ...facade, defaultTab: undefined })).toBe("reading");
    expect(defaultFaceId({ ...facade, defaultTab: "admin" })).toBe("admin");
    // A default naming a tab that is not there is a board edited since.
    expect(defaultFaceId({ ...facade, defaultTab: "nope" })).toBe("reading");
  });

  it("falls back to the first face when the chosen tab is gone", () => {
    const { faces } = resolveFaces(facade);
    expect(currentFace(faces, "admin")?.tab.id).toBe("admin");
    expect(currentFace(faces, "removed")?.tab.id).toBe("reading");
    expect(currentFace([], "reading")).toBeNull();
  });
});

/**
 * Whether a node is actually on screen: hiding a face is done by its container,
 * so the panel itself carries no mark of it.
 */
function onScreen(el: HTMLElement): boolean {
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    if (node.style.display === "none") {
      return false;
    }
  }
  return true;
}

describe("a facade with tabs on screen", () => {
  const show = (descriptor: FacadeDescriptor = facade) =>
    render(
      <MobileFacadeView
        facade={descriptor}
        boardContext={boardContext}
        boardName="tabs-board"
      />,
    );

  it("opens on the tab the board names, with the shared panel beside it", () => {
    show();
    expect(onScreen(screen.getByText("the articles"))).toBe(true);
    expect(onScreen(screen.getByText("always here"))).toBe(true);
    // Mounted — a hidden panel keeps whatever its widgets were holding — but
    // not on screen.
    expect(onScreen(screen.getByText("the feed list"))).toBe(false);
  });

  it("switches faces without unmounting the one left behind", () => {
    show();
    fireEvent.click(screen.getByRole("tab", { name: "Feeds" }));
    expect(onScreen(screen.getByText("the feed list"))).toBe(true);
    expect(onScreen(screen.getByText("the articles"))).toBe(false);
    expect(onScreen(screen.getByText("always here"))).toBe(true);
  });

  it("draws no tab bar for a facade that declares none", () => {
    show({ ...facade, tabs: undefined });
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(onScreen(screen.getByText("the articles"))).toBe(true);
    expect(onScreen(screen.getByText("the feed list"))).toBe(true);
  });
});

describe("the desktop renderer", () => {
  it("draws the same faces, with the board's runtimes below them", () => {
    render(
      <FacadeRenderer
        facade={facade}
        boardContext={boardContext}
        boardName="tabs-board"
        runtimeContent={<div>the runtimes</div>}
      />,
    );
    expect(onScreen(screen.getByText("the articles"))).toBe(true);
    expect(onScreen(screen.getByText("always here"))).toBe(true);
    expect(onScreen(screen.getByText("the feed list"))).toBe(false);

    fireEvent.click(screen.getByRole("tab", { name: "Feeds" }));
    expect(onScreen(screen.getByText("the feed list"))).toBe(true);
    expect(onScreen(screen.getByText("the articles"))).toBe(false);
  });
});
