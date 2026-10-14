import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({
  board: null as any,
  run: vi.fn(),
  models: vi.fn(),
  link: vi.fn(),
}));
vi.mock("../BoardContext", () => ({ useBoardContext: () => mocks.board }));
vi.mock("../selection/SelectionContext", () => ({
  useSelection: () => ({
    selectedRuntimeId: "ui",
    selectedServices: { uuids: ["timer"] },
  }),
}));
vi.mock("../runtime/ui/NestedNavigation", () => ({
  useNestedNavigation: () => ({ stack: [{ id: "nested", label: "Inner" }] }),
}));
vi.mock("../core/boardPersistence", () => ({ linkBoardDocument: mocks.link }));
vi.mock("../ui-components/SettingsDialog", () => ({ default: () => null }));
vi.mock("./anthropic", () => ({
  listAssistModels: mocks.models,
  runAssistTurn: mocks.run,
  modelEfforts: () => ["default", "medium"],
}));
import BoardAssistPanel from "./BoardAssistPanel";
import { saveAssistSettings } from "./settings";
const original = {
  boardName: "Before",
  runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
  services: {
    ui: [{ uuid: "timer", serviceId: "timer", state: { interval: 500 } }],
  },
  assets: [{ id: "text", text: "Keep me" }],
  blocks: [],
};
const proposed = {
  ...original,
  boardName: "After",
  services: {
    ui: [{ uuid: "timer", serviceId: "timer", state: { interval: 60000 } }],
  },
};
beforeEach(() => {
  localStorage.clear();
  saveAssistSettings({ anthropicToken: "test-token" });
  mocks.models.mockResolvedValue([
    { id: "queried", display_name: "Queried model" },
  ]);
  mocks.run.mockResolvedValue({
    conversation: [],
    text: "Changed timer to one minute.",
    board: proposed,
  });
  mocks.link.mockResolvedValue({ board: proposed });
  mocks.board = {
    boardName: "Before",
    runtimes: original.runtimes,
    availableRuntimeEngines: [],
    registry: {},
    facade: undefined,
    serializeBoardDocuments: vi.fn(async () => ({
      composition: original,
      units: [],
    })),
    setBoardState: vi.fn(async () => {}),
    markBoardChanged: vi.fn(),
  };
});
function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const result = render(
    <BoardAssistPanel host={host} visible onClose={() => {}} />,
  );
  return { ...result, host };
}
async function requestProposal() {
  await screen.findByRole("option", { name: "Queried model" });
  fireEvent.change(screen.getByLabelText("Message to board assistant"), {
    target: { value: "Change this timer" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByRole("button", { name: "Apply board" });
}
describe("board assistant panel", () => {
  it("sends fresh configuration and selection, applies only on click, and reverts the exact previous board", async () => {
    const view = mount();
    expect(screen.queryByRole("button", { name: "Revert last change" })).toBeNull();
    await requestProposal();
    expect((screen.getByRole("button", { name: "Revert last change" }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.board.setBoardState).not.toHaveBeenCalled();
    expect(mocks.run.mock.calls[0][0].context).toMatchObject({
      board: original,
      selectedRuntimeId: "ui",
      selectedServiceUuids: ["timer"],
      openNestedPipeline: [{ id: "nested" }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply board" }));
    await screen.findByRole("button", { name: "Applied" });
    expect(mocks.board.setBoardState).toHaveBeenCalledWith(proposed);
    fireEvent.click(screen.getByRole("button", { name: "Revert last change" }));
    await waitFor(() =>
      expect(mocks.board.setBoardState).toHaveBeenLastCalledWith({
        ...original,
        facade: undefined,
      }),
    );
    view.unmount();
    view.host.remove();
  });
  it("preserves unsaved imported unit documents when loading and reverting", async () => {
    const unit = {
      name: "helper",
      uri: "helper",
      board: { ...original, boardName: "Unsaved unit" },
    };
    mocks.board.serializeBoardDocuments.mockResolvedValue({
      composition: original,
      units: [unit],
    });
    const view = mount();
    await requestProposal();
    expect(mocks.run.mock.calls[0][0].context.importedUnitDocuments).toEqual([
      unit,
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Apply board" }));
    await screen.findByRole("button", { name: "Applied" });
    const origin = mocks.board.setBoardState.mock.calls[0][1];
    expect(await origin.load({ kind: "relative", value: "helper" })).toEqual(
      unit.board,
    );
    fireEvent.click(screen.getByRole("button", { name: "Revert last change" }));
    await waitFor(() =>
      expect(mocks.board.setBoardState).toHaveBeenCalledTimes(2),
    );
    expect(
      await mocks.board.setBoardState.mock.calls[1][1].load({
        kind: "relative",
        value: "helper",
      }),
    ).toEqual(unit.board);
    view.unmount();
    view.host.remove();
  });
  it("refuses to overwrite manual edits made after a proposal", async () => {
    const view = mount();
    await requestProposal();
    mocks.board.serializeBoardDocuments.mockResolvedValue({
      composition: { ...original, services: { ui: [] } },
      units: [],
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply board" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "board changed",
    );
    expect(mocks.board.setBoardState).not.toHaveBeenCalled();
    view.unmount();
    view.host.remove();
  });
  it("keeps a revert available when loading the proposed board fails", async () => {
    const view = mount();
    await requestProposal();
    mocks.board.setBoardState.mockRejectedValueOnce(
      new Error("Runtime unavailable"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply board" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Runtime unavailable",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Revert last change",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    view.unmount();
    view.host.remove();
  });
});
