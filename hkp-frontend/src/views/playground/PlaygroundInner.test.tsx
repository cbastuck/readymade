import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Children, isValidElement } from "react";

import { BoardCtx, BoardContextState } from "../../BoardContext";
import PlaygroundInner from "./PlaygroundInner";
import { PlaygroundInnerProps } from "./Playground.types";

vi.mock("../../components/Toolbar", () => ({
  default: ({ actionsSlot }: { actionsSlot?: React.ReactNode }) => {
    const actions = isValidElement<{ children?: React.ReactNode }>(actionsSlot)
      ? Children.toArray(actionsSlot.props.children)
      : [];
    return <div data-testid="toolbar">{actions[0]}</div>;
  },
}));

vi.mock("../../assist/BoardAssistPanel", () => ({
  default: () => <input aria-label="Mock Board Assist prompt" />,
}));

vi.mock("hkp-frontend/src/components/Footer", () => ({
  default: () => <div data-testid="footer" />,
}));

vi.mock("../../components/SaveBoardDialog", () => ({
  default: ({ suggestedName }: { suggestedName: string }) => (
    <div data-testid="save-board-dialog" data-suggested-name={suggestedName} />
  ),
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
    boardGeneration: 0,
    boardSessionGeneration: 0,
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
    remoteRuntimeStore: undefined,
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

  it("suggests the loaded board's name when saving", () => {
    const context = createBoardContext({ boardName: "Animate" });

    render(
      <BoardCtx.Provider value={context}>
        <PlaygroundInner {...createProps({ suggestedName: "Idea" })} />
      </BoardCtx.Provider>,
    );

    expect(
      screen
        .getByTestId("save-board-dialog")
        .getAttribute("data-suggested-name"),
    ).toBe("Animate");
  });

  it("falls back to the suggested name for a board that has none", () => {
    const context = createBoardContext({ boardName: undefined });

    render(
      <BoardCtx.Provider value={context}>
        <PlaygroundInner {...createProps({ suggestedName: "Idea" })} />
      </BoardCtx.Provider>,
    );

    expect(
      screen
        .getByTestId("save-board-dialog")
        .getAttribute("data-suggested-name"),
    ).toBe("Idea");
  });

  it("starts a fresh Board Assist session when a new board is opened", async () => {
    const context = createBoardContext();
    const props = createProps({ requestedBoardName: "first-board" });
    const view = render(
      <BoardCtx.Provider value={context}>
        <PlaygroundInner {...props} />
      </BoardCtx.Provider>,
    );
    fireEvent.click(screen.getByLabelText("Toggle Board Assist"));
    const prompt = await screen.findByLabelText("Mock Board Assist prompt");
    fireEvent.change(prompt, { target: { value: "Old board question" } });
    expect((prompt as HTMLInputElement).value).toBe("Old board question");

    view.rerender(
      <BoardCtx.Provider
        value={createBoardContext({ boardSessionGeneration: 1 })}
      >
        <PlaygroundInner {...props} requestedBoardName="second-board" />
      </BoardCtx.Provider>,
    );

    const freshPrompt = await screen.findByLabelText(
      "Mock Board Assist prompt",
    );
    expect((freshPrompt as HTMLInputElement).value).toBe("");
  });
});
