import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({
  board: null as any,
  run: vi.fn(),
  models: vi.fn(),
  link: vi.fn(),
  localModels: vi.fn(),
  localRun: vi.fn(),
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
vi.mock("../components/shared/Editor", () => ({
  default: ({
    value,
    onChange,
    readOnly,
    options,
  }: {
    value: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
    options?: { ariaLabel?: string; placeholder?: string };
  }) => (
    <textarea
      aria-label={options?.ariaLabel}
      placeholder={options?.placeholder}
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
  DiffEditor: ({
    original,
    modified,
    onChange,
    readOnly,
  }: {
    original: string;
    modified: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
  }) => (
    <div>
      <pre data-testid="diff-original">{original}</pre>
      <pre data-testid="diff-modified">{modified}</pre>
      <textarea
        aria-label="Proposed configuration"
        value={modified}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </div>
  ),
}));
vi.mock("./anthropic", () => ({
  listAssistModels: mocks.models,
  runAssistTurn: mocks.run,
  modelEfforts: () => ["default", "medium"],
}));
vi.mock("./openAICompatible", () => ({
  listOpenAIModels: mocks.localModels,
  runOpenAICompatibleTurn: mocks.localRun,
}));
import BoardAssistPanel from "./BoardAssistPanel";
import { readAssistSettings, saveAssistSettings } from "./settings";
import { BOARD_RENDER_FAILURE_EVENT } from "../core/renderFailures";
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
  await requestUnappliedProposal();
  fireEvent.click(screen.getByRole("button", { name: "Apply board" }));
  await screen.findByRole("button", { name: "Revert" });
}
async function requestUnappliedProposal() {
  await screen.findByRole("option", { name: "Queried model" });
  fireEvent.change(screen.getByLabelText("Message to Board Assist"), {
    target: { value: "Change this timer" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByRole("button", { name: "Apply board" });
}
describe("Board Assist panel", () => {
  it("keeps model settings collapsed until requested", async () => {
    const view = mount();
    const heading = screen.getByText("Model settings");
    const disclosure = heading.closest("details");
    expect(disclosure?.open).toBe(false);
    expect(screen.getByLabelText("Context")).toBeTruthy();
    fireEvent.click(heading.closest("summary")!);
    expect(disclosure?.open).toBe(true);
    expect(screen.getByLabelText("Provider")).toBeTruthy();
    expect(screen.getByLabelText("Model")).toBeTruthy();
    expect(screen.getByLabelText("Effort")).toBeTruthy();
    view.unmount();
    view.host.remove();
  });
  it("shows the product mark while the conversation is empty", () => {
    const view = mount();
    expect(screen.getByLabelText("Readymade")).toBeTruthy();
    expect(
      screen.queryByText(/Describe a new board/),
    ).toBeNull();
    view.unmount();
    view.host.remove();
  });
  it("resizes from its left edge and remembers the chosen width", () => {
    const view = mount();
    const panel = screen.getByLabelText("Board Assist");
    const resizer = screen.getByRole("separator", {
      name: "Resize Board Assist",
    });
    expect(panel.style.getPropertyValue("--hkp-assist-width")).toBe("390px");

    fireEvent(
      resizer,
      new MouseEvent("pointerdown", { clientX: 500, bubbles: true }),
    );
    fireEvent(
      window,
      new MouseEvent("pointermove", { clientX: 400, bubbles: true }),
    );
    fireEvent(
      window,
      new MouseEvent("pointerup", { clientX: 400, bubbles: true }),
    );

    expect(panel.style.getPropertyValue("--hkp-assist-width")).toBe("490px");
    expect(localStorage.getItem("hkp-board-assist-width")).toBe("490");

    fireEvent.doubleClick(resizer);
    expect(panel.style.getPropertyValue("--hkp-assist-width")).toBe("390px");
    expect(localStorage.getItem("hkp-board-assist-width")).toBeNull();
    view.unmount();
    view.host.remove();
  });
  it("restores a previously chosen panel width", () => {
    localStorage.setItem("hkp-board-assist-width", "520");
    const view = mount();
    expect(
      screen
        .getByLabelText("Board Assist")
        .style.getPropertyValue("--hkp-assist-width"),
    ).toBe("520px");
    view.unmount();
    view.host.remove();
  });
  it("resizes the prompt and remembers its height", () => {
    const view = mount();
    const resizer = screen.getByRole("separator", {
      name: "Resize conversation and prompt",
    });

    fireEvent(
      resizer,
      new MouseEvent("pointerdown", { clientY: 300, bubbles: true }),
    );
    fireEvent(
      window,
      new MouseEvent("pointermove", { clientY: 260, bubbles: true }),
    );
    fireEvent(window, new MouseEvent("pointerup", { bubbles: true }));

    expect(resizer.getAttribute("aria-valuenow")).toBe("152");
    expect(localStorage.getItem("hkp-board-assist-prompt-height")).toBe("152");

    fireEvent.doubleClick(resizer);
    expect(resizer.getAttribute("aria-valuenow")).toBe("112");
    expect(localStorage.getItem("hkp-board-assist-prompt-height")).toBeNull();
    view.unmount();
    view.host.remove();
  });
  it("restores a previously chosen prompt height", () => {
    localStorage.setItem("hkp-board-assist-prompt-height", "180");
    const view = mount();
    expect(
      screen
        .getByRole("separator", { name: "Resize conversation and prompt" })
        .getAttribute("aria-valuenow"),
    ).toBe("180");
    view.unmount();
    view.host.remove();
  });
  it("shows rejected local model output without offering it as a board", async () => {
    saveAssistSettings({
      provider: "openai-compatible",
      openAICompatibleUrl: "http://127.0.0.1:8081/v1",
    });
    mocks.localModels.mockResolvedValue([
      { id: "bonsai", display_name: "Bonsai" },
    ]);
    mocks.localRun.mockImplementationOnce(async (request) => {
      request.onRawResponse("Here is your board: {broken JSON}");
      throw new Error("The model did not return valid JSON.");
    });
    const view = mount();
    await screen.findByRole("option", { name: "Bonsai" });
    fireEvent.change(screen.getByLabelText("Message to Board Assist"), {
      target: { value: "Create a board" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Show raw model response");
    expect(screen.getByText("Here is your board: {broken JSON}")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Apply board" })).toBeNull();
    view.unmount();
    view.host.remove();
  });
  it("uses a local compatible provider without an Anthropic or OpenAI token", async () => {
    saveAssistSettings({
      provider: "openai-compatible",
      openAICompatibleUrl: "http://127.0.0.1:8081/v1",
      anthropicToken: "",
      openAICompatibleToken: "",
    });
    mocks.localModels.mockResolvedValue([
      { id: "Bonsai-27B-Q1_0.gguf", display_name: "Bonsai" },
    ]);
    mocks.localRun.mockResolvedValue({
      conversation: [],
      text: "Local proposal",
      board: proposed,
    });
    const view = mount();
    await screen.findByRole("option", { name: "Bonsai" });
    const effort = screen.getByLabelText("Effort");
    expect((effort as HTMLSelectElement).disabled).toBe(false);
    fireEvent.change(effort, { target: { value: "on" } });
    expect(readAssistSettings().openAIThinking).toBe("on");
    fireEvent.change(effort, { target: { value: "off" } });
    expect(readAssistSettings().openAIThinking).toBe("off");
    fireEvent.change(screen.getByLabelText("Message to Board Assist"), {
      target: { value: "Build locally" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    fireEvent.click(await screen.findByRole("button", { name: "Apply board" }));
    await screen.findByRole("button", { name: "Revert" });
    expect(mocks.localModels).toHaveBeenCalledWith(
      "http://127.0.0.1:8081/v1",
      "",
      expect.any(AbortSignal),
    );
    expect(mocks.localRun).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "http://127.0.0.1:8081/v1",
        token: "",
        contextTokens: 8192,
        thinking: "off",
      }),
    );
    expect(screen.queryByRole("button", { name: "API settings" })).toBeNull();
    view.unmount();
    view.host.remove();
  });
  it("passes an optional MCP knowledge provider to the model turn", async () => {
    saveAssistSettings({
      mcpKnowledgeUrl: "http://127.0.0.1:8787/mcp",
    });
    const view = mount();
    await requestUnappliedProposal();
    expect(mocks.run).toHaveBeenCalledWith(
      expect.objectContaining({
        knowledgeProvider: expect.objectContaining({
          id: "mcp+bundled",
          availableOffline: true,
        }),
      }),
    );
    view.unmount();
    view.host.remove();
  });
  it("sends fresh context, applies on request, and offers revert inside its message", async () => {
    const view = mount();
    expect(screen.queryByRole("button", { name: "Revert" })).toBeNull();
    await requestProposal();
    expect(
      (
        screen.getByRole("button", {
          name: "Revert",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(
      screen
        .getByRole("button", { name: "Revert" })
        .closest("article")
        ?.classList.contains("hkp-assist-assistant"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Show changes" })
        .closest("article")
        ?.classList.contains("hkp-assist-assistant"),
    ).toBe(true);
    expect(mocks.board.setBoardState).toHaveBeenCalledWith(proposed);
    expect(mocks.run.mock.calls[0][0].scope).toEqual({
      kind: "runtime",
      runtimeId: "ui",
      runtimeName: "Browser",
    });
    expect(mocks.run.mock.calls[0][0].context).toMatchObject({
      scope: "runtime",
      editableRuntime: original.runtimes[0],
      editableServices: original.services.ui,
      selectedServiceUuids: ["timer"],
      openNestedPipeline: [{ id: "nested" }],
    });
    expect(mocks.run.mock.calls[0][0].context.board).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Revert" }));
    await waitFor(() =>
      expect(mocks.board.setBoardState).toHaveBeenLastCalledWith({
        ...original,
        facade: undefined,
      }),
    );
    view.unmount();
    view.host.remove();
  });
  it("keeps a generated board as a proposal until the person applies it", async () => {
    const view = mount();
    await requestUnappliedProposal();
    expect(mocks.board.setBoardState).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Apply board" })).toBeTruthy();
    view.unmount();
    view.host.remove();
  });
  it("keeps a failed preflight proposal available without loading it", async () => {
    mocks.link.mockRejectedValueOnce(new Error("Unknown facade service"));
    const view = mount();
    await requestUnappliedProposal();
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Preflight failed: Unknown facade service",
    );
    expect(
      (screen.getByRole("button", {
        name: "Apply board",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByRole("button", { name: "Show changes" })).toBeTruthy();
    expect(mocks.board.setBoardState).not.toHaveBeenCalled();
    view.unmount();
    view.host.remove();
  });
  it("reviews the automatically applied change against the previous board", async () => {
    const view = mount();
    await requestProposal();
    fireEvent.click(screen.getByRole("button", { name: "Show changes" }));
    await screen.findByRole("dialog", { name: "Review board changes" });
    expect(
      JSON.parse(screen.getByTestId("diff-original").textContent!),
    ).toEqual(original);
    expect(
      JSON.parse(screen.getByTestId("diff-modified").textContent!),
    ).toEqual(proposed);
    expect(mocks.board.setBoardState).toHaveBeenCalledWith(proposed);
    expect(
      (screen.getByLabelText("Proposed configuration") as HTMLTextAreaElement)
        .readOnly,
    ).toBe(true);
    expect(
      screen.queryByRole("button", { name: "Apply edited board" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "close-dialog-button" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    view.unmount();
    view.host.remove();
  });
  it("applies manually edited JSON from the diff and can revert it", async () => {
    const view = mount();
    await requestUnappliedProposal();
    fireEvent.click(screen.getByRole("button", { name: "Show changes" }));
    const editor = await screen.findByLabelText("Proposed configuration");
    const edited = { ...proposed, boardName: "Manual version" };
    fireEvent.change(editor, { target: { value: JSON.stringify(edited) } });
    expect(mocks.board.setBoardState).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply edited board" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.board.setBoardState).toHaveBeenCalledWith(edited);
    fireEvent.click(screen.getByRole("button", { name: "Revert" }));
    await waitFor(() =>
      expect(mocks.board.setBoardState).toHaveBeenLastCalledWith(original),
    );
    view.unmount();
    view.host.remove();
  });
  it("keeps invalid JSON in the diff and refuses to load it", async () => {
    const view = mount();
    await requestUnappliedProposal();
    fireEvent.click(screen.getByRole("button", { name: "Show changes" }));
    const editor = await screen.findByLabelText("Proposed configuration");
    fireEvent.change(editor, { target: { value: "{" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply edited board" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(mocks.board.setBoardState).not.toHaveBeenCalled();
    fireEvent.change(editor, { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply edited board" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "runtimes",
    );
    expect(mocks.board.setBoardState).not.toHaveBeenCalled();
    view.unmount();
    view.host.remove();
  });
  it("protects edits to the live board made while the diff is open", async () => {
    const view = mount();
    await requestUnappliedProposal();
    fireEvent.click(screen.getByRole("button", { name: "Show changes" }));
    await screen.findByLabelText("Proposed configuration");
    mocks.board.serializeBoardDocuments.mockResolvedValue({
      composition: { ...original, services: { ui: [] } },
      units: [],
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply edited board" }));
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("alert")
          .some((alert) => alert.textContent?.includes("board changed")),
      ).toBe(true),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(mocks.board.setBoardState).not.toHaveBeenCalled();
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
    fireEvent.change(screen.getByLabelText("Context"), {
      target: { value: "board" },
    });
    await requestProposal();
    expect(mocks.run.mock.calls[0][0].context.importedUnitDocuments).toEqual([
      {
        ...unit,
        board: {
          ...unit.board,
          assets: [{ id: "text", contentOmitted: true }],
        },
      },
    ]);
    const origin = mocks.board.setBoardState.mock.calls[0][1];
    expect(await origin.load({ kind: "relative", value: "helper" })).toEqual(
      unit.board,
    );
    fireEvent.click(screen.getByRole("button", { name: "Revert" }));
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
  it("applies a follow-up proposal while the existing Timer keeps ticking", async () => {
    const before = {
      ...original,
      services: {
        ui: [
          {
            ...original.services.ui[0],
            state: { periodicValue: 1, counter: 1 },
          },
        ],
      },
    };
    mocks.board.serializeBoardDocuments.mockResolvedValue({
      composition: before,
      units: [],
    });
    const ticking = {
      ...before,
      services: {
        ui: [
          { ...before.services.ui[0], state: { periodicValue: 1, counter: 4 } },
        ],
      },
    };
    mocks.board.serializeBoardDocuments.mockResolvedValue({
      composition: before,
      units: [],
    });
    mocks.run.mockImplementationOnce(async () => {
      mocks.board.serializeBoardDocuments.mockResolvedValue({
        composition: ticking,
        units: [],
      });
      return {
        conversation: [],
        text: "Changed timer to one minute.",
        board: proposed,
      };
    });
    const view = mount();
    await requestProposal();
    expect(mocks.board.setBoardState).toHaveBeenCalledWith(proposed);
    fireEvent.click(screen.getByRole("button", { name: "Revert" }));
    await waitFor(() =>
      expect(mocks.board.setBoardState).toHaveBeenLastCalledWith(ticking),
    );
    view.unmount();
    view.host.remove();
  });
  it("refuses to overwrite manual edits made after a proposal", async () => {
    const manuallyEdited = { ...original, services: { ui: [] } };
    mocks.run.mockImplementationOnce(async () => {
      mocks.board.serializeBoardDocuments.mockResolvedValue({
        composition: manuallyEdited,
        units: [],
      });
      return {
        conversation: [],
        text: "Changed timer to one minute.",
        board: proposed,
      };
    });
    const view = mount();
    await requestUnappliedProposal();
    fireEvent.click(screen.getByRole("button", { name: "Apply board" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "board changed",
    );
    expect(mocks.board.setBoardState).not.toHaveBeenCalled();
    view.unmount();
    view.host.remove();
  });
  it("automatically restores the previous board when loading the proposal fails", async () => {
    mocks.board.setBoardState.mockRejectedValueOnce(
      new Error("Runtime unavailable"),
    );
    const view = mount();
    await requestUnappliedProposal();
    fireEvent.click(screen.getByRole("button", { name: "Apply board" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Runtime unavailable",
    );
    await waitFor(() =>
      expect(mocks.board.setBoardState).toHaveBeenCalledTimes(2),
    );
    expect(mocks.board.setBoardState).toHaveBeenLastCalledWith(original);
    expect(screen.queryByRole("button", { name: "Revert" })).toBeNull();
    expect(screen.getByRole("button", { name: "Apply board" })).toBeTruthy();
    view.unmount();
    view.host.remove();
  });
  it("automatically restores when a proposed service panel fails to render", async () => {
    mocks.board.setBoardState.mockImplementationOnce(async () => {
      window.dispatchEvent(
        new CustomEvent(BOARD_RENDER_FAILURE_EVENT, {
          detail: {
            scope: "Service Filter",
            message: "conditions.map is not a function",
          },
        }),
      );
    });
    const view = mount();
    await requestUnappliedProposal();
    fireEvent.click(screen.getByRole("button", { name: "Apply board" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "could not render",
    );
    await waitFor(() =>
      expect(mocks.board.setBoardState).toHaveBeenCalledTimes(2),
    );
    expect(mocks.board.setBoardState).toHaveBeenLastCalledWith(original);
    expect(screen.getByRole("button", { name: "Apply board" })).toBeTruthy();
    view.unmount();
    view.host.remove();
  });
  it("asks before applying a proposal that contacts a new server", async () => {
    const remote = {
      ...proposed,
      runtimes: [
        ...original.runtimes,
        { id: "node", name: "Node", type: "rest", url: "https://new.example" },
      ],
      services: { ...proposed.services, node: [] },
    };
    mocks.run.mockResolvedValue({ conversation: [], text: "Added", board: remote });
    const view = mount();
    await requestUnappliedProposal();
    fireEvent.click(screen.getByRole("button", { name: "Apply board" }));
    expect(
      (await screen.findByText("https://new.example")).closest("div")
        ?.textContent,
    ).toBeTruthy();
    expect(mocks.board.setBoardState).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Don't apply" }));
    expect(screen.queryByText("https://new.example")).toBeNull();
    expect(mocks.board.setBoardState).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply board" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Trust and apply" }),
    );
    await screen.findByRole("button", { name: "Revert" });
    expect(mocks.board.setBoardState).toHaveBeenCalledWith(remote);
    view.unmount();
    view.host.remove();
  });
  it("asks about new servers in the review dialog too", async () => {
    const view = mount();
    await requestUnappliedProposal();
    fireEvent.click(screen.getByRole("button", { name: "Show changes" }));
    const editor = await screen.findByLabelText("Proposed configuration");
    const edited = {
      ...proposed,
      services: {
        ui: [
          {
            uuid: "timer",
            serviceId: "timer",
            state: { interval: 1, target: "wss://collect.example/in" },
          },
        ],
      },
    };
    fireEvent.change(editor, { target: { value: JSON.stringify(edited) } });
    fireEvent.click(screen.getByRole("button", { name: "Apply edited board" }));
    await screen.findByText("wss://collect.example");
    expect(mocks.board.setBoardState).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Trust and apply" }));
    await waitFor(() =>
      expect(mocks.board.setBoardState).toHaveBeenCalledWith(edited),
    );
    await waitFor(() =>
      expect(screen.queryByLabelText("Proposed configuration")).toBeNull(),
    );
    view.unmount();
    view.host.remove();
  });
  it("forgets what to revert when a new conversation starts", async () => {
    const view = mount();
    await requestProposal();
    fireEvent.click(screen.getByRole("button", { name: "New conversation" }));
    await requestUnappliedProposal();
    expect(screen.queryByRole("button", { name: "Revert" })).toBeNull();
    view.unmount();
    view.host.remove();
  });
  it("asks before a revert discards changes made after applying", async () => {
    const view = mount();
    await requestProposal();
    mocks.board.serializeBoardDocuments.mockResolvedValue({
      composition: {
        ...original,
        services: {
          ui: [{ uuid: "timer", serviceId: "timer", state: { interval: 7 } }],
        },
      },
      units: [],
    });
    fireEvent.click(screen.getByRole("button", { name: "Revert" }));
    await screen.findByText(/discards those later changes/);
    expect(mocks.board.setBoardState).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Keep current board" }));
    expect(screen.queryByText(/discards those later changes/)).toBeNull();
    expect(mocks.board.setBoardState).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Revert" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Revert anyway" }),
    );
    await waitFor(() =>
      expect(mocks.board.setBoardState).toHaveBeenCalledTimes(2),
    );
    view.unmount();
    view.host.remove();
  });
  it("sends asset contents only when asked to", async () => {
    const view = mount();
    fireEvent.change(screen.getByLabelText("Context"), {
      target: { value: "board" },
    });
    await requestUnappliedProposal();
    expect(mocks.run.mock.calls[0][0].context.board.assets).toEqual([
      { id: "text", contentOmitted: true },
    ]);
    fireEvent.click(screen.getByLabelText("Include asset contents"));
    expect(readAssistSettings().includeAssetContents).toBe(true);
    fireEvent.change(screen.getByLabelText("Message to Board Assist"), {
      target: { value: "Again" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(2));
    expect(mocks.run.mock.calls[1][0].context.board.assets).toEqual(
      original.assets,
    );
    view.unmount();
    view.host.remove();
  });
  it("warns when a model server is reached over plain HTTP on another machine", async () => {
    mocks.localModels.mockResolvedValue([{ id: "local", display_name: "Local" }]);
    saveAssistSettings({
      provider: "openai-compatible",
      openAICompatibleUrl: "http://192.168.1.20:8081/v1",
    });
    const view = mount();
    expect(
      (await screen.findByText(/unencrypted HTTP on another machine/)).getAttribute(
        "role",
      ),
    ).toBe("alert");
    view.unmount();
    view.host.remove();
    saveAssistSettings({ openAICompatibleUrl: "http://127.0.0.1:8081/v1" });
    const local = mount();
    await screen.findByRole("option", { name: "Local" });
    expect(screen.queryByText(/unencrypted HTTP on another machine/)).toBeNull();
    local.unmount();
    local.host.remove();
  });
  it("names a kept server instead of the address a proposal wrote", async () => {
    mocks.board.availableRuntimeEngines = [
      { type: "rest", name: "Laptop", url: "http://127.0.0.1:8080", aliases: ["node"] },
    ];
    const addressed = {
      ...proposed,
      runtimes: [
        ...original.runtimes,
        { id: "node", name: "Node", type: "rest", url: "http://127.0.0.1:8080" },
      ],
      services: { ...proposed.services, node: [] },
    };
    mocks.run.mockResolvedValue({ conversation: [], text: "Added", board: addressed });
    const view = mount();
    await requestUnappliedProposal();
    expect(
      await screen.findByText(/node now names your server "node"/),
    ).toBeTruthy();
    expect(JSON.stringify(mocks.run.mock.calls[0][0].context)).not.toContain(
      "127.0.0.1:8080",
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply board" }));
    await screen.findByRole("button", { name: "Revert" });
    expect(screen.queryByRole("button", { name: "Trust and apply" })).toBeNull();
    expect(mocks.board.setBoardState).toHaveBeenCalledWith({
      ...addressed,
      runtimes: [
        ...original.runtimes,
        { id: "node", name: "Node", type: "rest", remote: "node" },
      ],
    });
    view.unmount();
    view.host.remove();
  });
});
