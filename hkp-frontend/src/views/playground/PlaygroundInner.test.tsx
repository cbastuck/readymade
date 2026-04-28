import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { BoardCtx, BoardContextState } from "../../BoardContext";
import PlaygroundInner from "./PlaygroundInner";
import { PlaygroundInnerProps } from "./Playground.types";

vi.mock("../../components/Toolbar", () => ({
  default: () => <div data-testid="toolbar" />,
}));

vi.mock("hkp-frontend/src/components/Footer", () => ({
  default: () => <div data-testid="footer" />,
}));

vi.mock("../../components/SaveBoardDialog", () => ({
  default: () => <div data-testid="save-board-dialog" />,
}));

vi.mock("hkp-frontend/src/components/ShareQRCodeDialog", () => ({
  default: () => <div data-testid="share-qr-dialog" />,
}));

vi.mock("./BoardFetchError", () => ({
  default: ({ boardName, error }: { boardName: string; error: Error }) => (
    <div data-testid="board-fetch-error">
      {boardName}:{error.message}
    </div>
  ),
}));

vi.mock("./BoardEntryPoint", () => ({
  default: ({
    requestedBoardName,
    description,
    isLoading,
    showLoginRequired,
  }: {
    requestedBoardName?: string;
    description: string;
    isLoading: boolean;
    showLoginRequired: boolean;
  }) => (
    <div
      data-testid="board-entry-point"
      data-requested-board-name={requestedBoardName || ""}
      data-description={description}
      data-loading={String(isLoading)}
      data-login-required={String(showLoginRequired)}
    />
  ),
}));

function createBoardContext(
  overrides: Partial<BoardContextState> = {},
): BoardContextState {
  return {
    user: null,
    boardName: "demo-board",
    facade: undefined,
    runtimes: [],
    services: {},
    registry: {},
    scopes: {},
    availableRuntimeEngines: [],
    runtimeApis: {},
    appContext: null,
    awaitUserLogin: null,
    errorOnFetch: undefined,
    isFetching: false,
    fetchBoard: vi.fn(async () => {}),
    addRuntime: vi.fn(),
    addService: vi.fn(),
    arrangeService: vi.fn(),
    arrangeRuntime: vi.fn(),
    removeService: vi.fn(),
    removeRuntime: vi.fn(),
    updateRuntime: vi.fn(async () => {}),
    removeAllServices: vi.fn(),
    setBoardName: vi.fn(),
    clearBoard: vi.fn(async () => {}),
    onAction: vi.fn(),
    isRuntimeInScope: vi.fn(() => true),
    acquireRuntimeScope: vi.fn(),
    releaseRuntimeScope: vi.fn(),
    isActionAvailable: vi.fn(() => true),
    setRuntimeName: vi.fn(),
    setServiceName: vi.fn(),
    addAvailableRuntime: vi.fn(() => []),
    removeAvailableRuntime: vi.fn(() => []),
    serializeBoard: vi.fn(async () => null),
    setBoardState: vi.fn(async () => {}),
    ...overrides,
  } as BoardContextState;
}

function createProps(
  overrides: Partial<PlaygroundInnerProps> = {},
): PlaygroundInnerProps {
  return {
    description: "Demo description",
    compact: false,
    hideNavigation: false,
    menuSlot: null,
    logoSlot: null,
    menuItemFactory: undefined,
    showShareBoardQRCodeURL: null,
    setShowShareBoardQRCodeURL: vi.fn(),
    isSaveDialogVisible: false,
    suggestedName: "demo-board",
    onSaveDialog: vi.fn(async () => null),
    setIsSaveDialogVisible: vi.fn(),
    onChangeBoardname: vi.fn(),
    onUpdateAvailableRuntimeEngines: undefined,
    requestedBoardName: "requested-board",
    children: null,
    emptySlot: null,
    ...overrides,
  };
}

describe("PlaygroundInner", () => {
  it("renders the fetch error branch when board loading fails", () => {
    const error = new Error("fetch failed");
    const context = createBoardContext({
      boardName: "failing-board",
      errorOnFetch: error,
    });

    render(
      <BoardCtx.Provider value={context}>
        <PlaygroundInner {...createProps({ requestedBoardName: "fallback" })} />
      </BoardCtx.Provider>,
    );

    expect(screen.getByTestId("board-fetch-error").textContent).toContain(
      "failing-board:fetch failed",
    );
    expect(screen.queryByTestId("board-entry-point")).toBeNull();
  });

  it("renders BoardEntryPoint when there is no fetch error", () => {
    const context = createBoardContext({
      boardName: "healthy-board",
      isFetching: true,
      awaitUserLogin: () => {},
    });

    render(
      <BoardCtx.Provider value={context}>
        <PlaygroundInner
          {...createProps({
            requestedBoardName: "requested-board",
            description: "Visible description",
          })}
        />
      </BoardCtx.Provider>,
    );

    const entryPoint = screen.getByTestId("board-entry-point");
    expect(entryPoint.getAttribute("data-requested-board-name")).toBe(
      "requested-board",
    );
    expect(entryPoint.getAttribute("data-description")).toBe(
      "Visible description",
    );
    expect(entryPoint.getAttribute("data-loading")).toBe("true");
    expect(entryPoint.getAttribute("data-login-required")).toBe("true");
    expect(screen.queryByTestId("board-fetch-error")).toBeNull();
  });
});
