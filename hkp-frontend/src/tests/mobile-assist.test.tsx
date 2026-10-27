import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

/**
 * Board Assist on a phone: the desktop panel's logic (`useBoardAssist`) as a
 * page. The request is narrowed to what the person opened last instead of a
 * selection, and a proposal is reviewed as what it does and the lines it
 * changes before it is applied.
 */

const mocks = vi.hoisted(() => ({
  board: null as any,
  run: vi.fn(),
  models: vi.fn(),
  link: vi.fn(),
}));
vi.mock("hkp-frontend/src/BoardContext", () => ({ useBoardContext: () => mocks.board }));
vi.mock("hkp-frontend/src/runtime/ui/NestedNavigation", () => ({
  useNestedNavigation: () => null,
}));
vi.mock("hkp-frontend/src/core/boardPersistence", () => ({ linkBoardDocument: mocks.link }));
vi.mock("hkp-frontend/src/assist/anthropic", () => ({
  listAssistModels: mocks.models,
  runAssistTurn: mocks.run,
  modelEfforts: () => ["default", "medium"],
}));
vi.mock("hkp-frontend/src/assist/openAICompatible", () => ({
  listOpenAIModels: vi.fn(),
  runOpenAICompatibleTurn: vi.fn(),
}));

import MobileAssistPage from "hkp-frontend/src/views/assist/MobileAssistPage";
import { saveAssistSettings } from "hkp-frontend/src/assist/settings";

const original = {
  boardName: "Before",
  runtimes: [
    { id: "ui", name: "Browser", type: "browser" },
    { id: "node", name: "Node", type: "rest", remote: "node" },
  ],
  services: {
    ui: [{ uuid: "timer", serviceId: "timer", serviceName: "Timer", state: { interval: 500 } }],
    node: [],
  },
};
const proposed = {
  ...original,
  services: {
    ui: [
      { uuid: "timer", serviceId: "timer", serviceName: "Timer", state: { interval: 60000 } },
      { uuid: "monitor", serviceId: "monitor", serviceName: "Monitor" },
    ],
    node: [],
  },
};

beforeEach(() => {
  localStorage.clear();
  mocks.run.mockReset();
  mocks.models.mockResolvedValue([{ id: "queried", display_name: "Queried model" }]);
  mocks.run.mockResolvedValue({
    conversation: [],
    text: "Slowed the timer and added a monitor.",
    board: proposed,
  });
  mocks.link.mockResolvedValue({ board: proposed });
  mocks.board = {
    boardName: "Before",
    runtimes: original.runtimes,
    services: original.services,
    availableRuntimeEngines: [],
    registry: {},
    facade: undefined,
    serializeBoardDocuments: vi.fn(async () => ({ composition: original, units: [] })),
    setBoardState: vi.fn(async () => {}),
    markBoardChanged: vi.fn(),
  };
});

const noFocus = { runtimeId: null, serviceUuids: [] };

async function ask(text: string) {
  await screen.findByText(/Queried model/);
  fireEvent.change(screen.getByLabelText("Request"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Slowed the timer and added a monitor.");
}

describe("the Assist page", () => {
  it("asks for a provider before anything else", () => {
    const onOpenSettings = vi.fn();
    render(
      <MobileAssistPage open onBack={() => {}} focus={noFocus} onOpenSettings={onOpenSettings} />,
    );
    expect((screen.getByLabelText("Request") as HTMLTextAreaElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Set up a provider" }));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it("narrows a request to the runtime opened last, and says so", async () => {
    saveAssistSettings({ anthropicToken: "test-token" });
    render(
      <MobileAssistPage
        open
        onBack={() => {}}
        focus={{ runtimeId: "ui", serviceUuids: ["timer"] }}
      />,
    );
    const context = screen.getByRole("radiogroup", { name: "Context" });
    const narrowed = within(context).getByRole("radio", { name: "Browser · Timer" });
    expect(narrowed.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(/runtime Browser with an outline/)).toBeTruthy();

    await ask("Slow it down");
    expect(mocks.run.mock.calls[0][0].scope).toEqual({
      kind: "runtime",
      runtimeId: "ui",
      runtimeName: "Browser",
    });

    fireEvent.click(within(context).getByRole("radio", { name: "Whole board" }));
    expect(screen.getByText(/the whole board, without asset contents/)).toBeTruthy();
  });

  it("offers only the whole board while nothing has been opened", () => {
    saveAssistSettings({ anthropicToken: "test-token" });
    render(<MobileAssistPage open onBack={() => {}} focus={noFocus} />);
    const other = screen.getByRole("radio", { name: "Open a runtime" }) as HTMLButtonElement;
    expect(other.disabled).toBe(true);
    expect(screen.getByRole("radio", { name: "Whole board" }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("reviews a proposal as what it does and the lines it changes, then applies it", async () => {
    saveAssistSettings({ anthropicToken: "test-token" });
    render(<MobileAssistPage open onBack={() => {}} focus={noFocus} />);
    await ask("Slow it down");
    expect(screen.getByText("Preflight passed. Review before applying.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
    await screen.findByText("Review changes", { selector: "span" });
    expect(screen.getByText("Changes Timer in Browser")).toBeTruthy();
    expect(screen.getByText("Adds Monitor to Browser")).toBeTruthy();
    const lines = screen.getByLabelText("Changed lines");
    expect(lines.querySelector('[data-kind="added"]')?.textContent).toBeTruthy();
    expect(mocks.board.setBoardState).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    await waitFor(() => expect(mocks.board.setBoardState).toHaveBeenCalledWith(proposed));
    await screen.findByText("Applied to the board.");
    expect(screen.queryByLabelText("Changed lines")).toBeNull();
    expect(screen.getByRole("button", { name: "Revert" })).toBeTruthy();
  });

  it("discards a proposal from its review without touching the board", async () => {
    saveAssistSettings({ anthropicToken: "test-token" });
    render(<MobileAssistPage open onBack={() => {}} focus={noFocus} />);
    await ask("Slow it down");
    fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard" }));
    await waitFor(() => expect(screen.queryByLabelText("Changed lines")).toBeNull());
    expect(mocks.board.setBoardState).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Apply" })).toBeTruthy();
  });

  it("keeps the conversation while it is hidden", async () => {
    saveAssistSettings({ anthropicToken: "test-token" });
    const view = render(<MobileAssistPage open onBack={() => {}} focus={noFocus} />);
    await ask("Slow it down");
    view.rerender(<MobileAssistPage open={false} onBack={() => {}} focus={noFocus} />);
    view.rerender(<MobileAssistPage open onBack={() => {}} focus={noFocus} />);
    expect(screen.getByText("Slowed the timer and added a monitor.")).toBeTruthy();
  });
});
