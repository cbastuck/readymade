import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { BoardContextState } from "../../BoardContext";

/**
 * The row of tabs a composition is looked at through.
 *
 * It is drawn outside the facade — above it, beside nothing — which is the whole
 * reason this is pinned: everything below it is painted by the facade, so a bar
 * that paints nothing is a strip of whatever the host happens to have behind the
 * board showing between the tabs. It reads as a hole in the page rather than as
 * the top of the facade.
 */

vi.mock("./Board", () => ({ default: () => <div data-testid="board" /> }));
vi.mock("../../facade/FacadeRenderer", () => ({
  default: ({ facade }: { facade: { panels: unknown[] } }) => (
    <div data-testid="facade" data-panels={facade.panels.length} />
  ),
}));
vi.mock("react-router-dom", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("../../facade/FacadeViewContext", () => ({
  useFacadeView: () => ({ showFacade: true, showRuntime: true, editorOpen: false }),
}));

import BoardEntryPoint from "./BoardEntryPoint";

/** A composition: two units, each contributing one view. */
function contextWithViews(): BoardContextState {
  const view = (id: string, title: string) => ({
    id,
    title,
    unit: id,
    facade: { layout: "single", panels: [{ id: `${id}-panel`, layout: { items: [] } }] },
    runtimeIds: [`${id}.node`],
  });
  return {
    boardName: "Reading Radio",
    runtimes: [{ id: "radio.node" }],
    services: {},
    scopes: {},
    registry: {},
    linkage: { views: [view("radio", "Radio"), view("library", "Radio Library")] },
  } as unknown as BoardContextState;
}

function renderEntryPoint() {
  return render(
    <BoardEntryPoint
      isLoading={false}
      showLoginRequired={false}
      boardContext={contextWithViews()}
      description=""
      onChangeBoardname={() => {}}
    />,
  );
}

describe("the tabs a composition's views are chosen by", () => {
  it("paints the facade's surface behind them", () => {
    renderEntryPoint();

    const bar = screen.getByRole("tablist");

    // The token names the surface the facade paints, and the value after the
    // comma is what a host that does not define it falls back to — a facade is
    // shown in hosts without the playground's tokens.
    expect(bar.style.background).toBe("hsl(var(--background, 0 0% 100%))");
  });

  it("names one tab per view", () => {
    renderEntryPoint();

    expect(screen.getByRole("tab", { name: "Radio" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Radio Library" })).toBeTruthy();
  });
});
