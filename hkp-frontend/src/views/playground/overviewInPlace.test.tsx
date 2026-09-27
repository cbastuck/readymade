import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

import type { BoardContextState } from "../../BoardContext";
import { OverviewProvider, useOverview } from "../../overview/OverviewContext";

/**
 * The overview in the board's place.
 *
 * The board is looked at as its runtimes or as the overview, in the same
 * place — beside the facade, or as the whole board where there is none. What
 * is pinned is that switching never remounts the runtimes: their panels keep
 * reporting and whatever draws keeps its size while the overview is on.
 */

let boardMounts = 0;
vi.mock("./Board", () => ({
  default: function Board() {
    useEffect(() => {
      boardMounts += 1;
    }, []);
    return <div data-testid="runtimes" />;
  },
}));
vi.mock("../../overview/OverviewView", () => ({
  default: () => <div data-testid="overview" />,
}));
vi.mock("../../facade/FacadeRenderer", () => ({
  default: ({ runtimeContent }: { runtimeContent: React.ReactNode }) => (
    <div data-testid="facade">{runtimeContent}</div>
  ),
}));
vi.mock("react-router-dom", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("../../facade/FacadeViewContext", () => ({
  useFacadeView: () => ({ showFacade: true, showRuntime: true, editorOpen: false }),
}));

import BoardEntryPoint from "./BoardEntryPoint";

let api: ReturnType<typeof useOverview>;
function Probe() {
  api = useOverview();
  return null;
}

function renderBoard({ withFacade }: { withFacade: boolean }) {
  boardMounts = 0;
  const boardContext = {
    boardName: "In Place",
    runtimes: [{ id: "ui" }],
    services: {},
    scopes: {},
    ...(withFacade ? { facade: { layout: "single", panels: [{ id: "p" }] } } : {}),
  } as unknown as BoardContextState;
  render(
    <OverviewProvider>
      <Probe />
      <BoardEntryPoint
        isLoading={false}
        showLoginRequired={false}
        boardContext={boardContext}
        description=""
        onChangeBoardname={() => {}}
      />
    </OverviewProvider>,
  );
}

describe.each([
  ["a board with a facade", true],
  ["a board without one", false],
])("the overview on %s", (_name, withFacade) => {
  it("takes the runtimes' place, and gives it back, remounting nothing", () => {
    renderBoard({ withFacade });
    expect(screen.queryByTestId("overview")).toBeNull();
    expect(boardMounts).toBe(1);

    act(() => api!.show());
    expect(screen.getByTestId("overview")).toBeTruthy();
    // Still there, only hidden: its panels keep reporting.
    const runtimes = screen.getByTestId("runtimes");
    expect(runtimes.parentElement!.style.visibility).toBe("hidden");

    act(() => api!.hide());
    expect(screen.queryByTestId("overview")).toBeNull();
    expect(screen.getByTestId("runtimes").parentElement!.style.visibility).toBe("");
    expect(boardMounts).toBe(1);
  });

  if (withFacade) {
    it("sits where the facade puts the runtimes", () => {
      renderBoard({ withFacade });
      act(() => api!.show());
      expect(
        screen.getByTestId("facade").contains(screen.getByTestId("overview")),
      ).toBe(true);
    });
  }
});
