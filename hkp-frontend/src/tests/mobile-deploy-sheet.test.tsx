import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DeployBoardSheet from "../views/playground/mobile/DeployBoardSheet";
import { MobileConnectionsProvider } from "../views/playground/mobile/MobileConnections";
import { checkDeploy, deployBoard } from "../core/deploy";
import {
  DeployPreflightError,
  RuntimePreflight,
} from "../core/deployPreflight";

const user = { userId: "user-1", idToken: "token", username: "someone" };

// The sheet only needs the board's deployable surface (name, serialize,
// hand-over) and the logged-in user; the real providers bring a whole board
// engine with them.
const boardContext = {
  boardName: "Voice Notes",
  serializeBoard: async () => ({ boardName: "Voice Notes" }),
};

vi.mock("../BoardContext", () => ({
  useBoardContext: () => boardContext,
}));

vi.mock("../AppContext", () => ({
  useAppContext: () => ({ user }),
}));

vi.mock("../auth/useCloudLogin", () => ({
  useCloudLogin: () => () => {},
}));

vi.mock("../core/deploy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../core/deploy")>()),
  checkDeploy: vi.fn(),
  deployBoard: vi.fn(async () => ({
    boardName: "Voice Notes",
    status: "running",
    errors: [],
    placements: [],
  })),
}));

const browser: RuntimePreflight = {
  runtimeId: "ui",
  name: "Browser",
  status: "transient",
};
const placed: RuntimePreflight = {
  runtimeId: "node",
  name: "Node",
  status: "ready",
  url: "http://laptop:8080",
  mode: "remote",
  remoteName: "node",
};
const away: RuntimePreflight = { ...placed, status: "unreachable" };

vi.mock("../views/cloud/coordinatorClient", () => ({
  listCoordinatorBoards: vi.fn(async () => []),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const COORDINATOR = { name: "Cloud", url: "https://coord.example/coordinator" };

function renderSheet(onDeployed = vi.fn()) {
  localStorage.setItem("hkp-coordinators", JSON.stringify([COORDINATOR]));
  render(
    <MobileConnectionsProvider>
      <DeployBoardSheet
        open
        onClose={() => {}}
        onDeployed={onDeployed}
        onManageCoordinators={() => {}}
      />
    </MobileConnectionsProvider>,
  );
  return onDeployed;
}

/** The coordinator's row, which is what deploys there. */
const coordinatorRow = () =>
  screen.getByText("Cloud").closest("button") as HTMLButtonElement;

describe("mobile deploy sheet", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(deployBoard).mockClear();
    vi.mocked(checkDeploy).mockReset();
    vi.mocked(checkDeploy).mockResolvedValue([browser, placed]);
  });

  it("lists the configured coordinators for the open board", () => {
    renderSheet();

    expect(screen.getByText("Voice Notes", { exact: false })).toBeTruthy();
    expect(screen.getByText("Cloud")).toBeTruthy();
    expect(screen.getByText(COORDINATOR.url)).toBeTruthy();
  });

  it("deploys to the chosen coordinator and hands the board back to attach to", async () => {
    const onDeployed = renderSheet();

    await waitFor(() => expect(coordinatorRow().disabled).toBe(false));
    fireEvent.click(screen.getByText("Cloud"));

    await waitFor(() => {
      expect(deployBoard).toHaveBeenCalledWith(boardContext, COORDINATOR, user);
    });
    await waitFor(() => {
      expect(onDeployed).toHaveBeenCalledWith(COORDINATOR, "Voice Notes");
    });
  });

  it("says what deploying would find, runtime by runtime, before anything is chosen", async () => {
    renderSheet();

    // Nothing is deployed while the runtimes are being asked.
    expect(screen.getByText("Checking the board’s runtimes…")).toBeTruthy();
    expect(coordinatorRow().disabled).toBe(true);

    expect(
      await screen.findByText("“Node” is ready on “node”"),
    ).toBeTruthy();
    expect(
      screen.getByText("“Browser” runs in the browser, only while the board is open"),
    ).toBeTruthy();
    expect(checkDeploy).toHaveBeenCalledWith(boardContext, user);
    expect(coordinatorRow().disabled).toBe(false);
  });

  it("refuses to deploy a board a runtime would stop, until checked again", async () => {
    vi.mocked(checkDeploy).mockResolvedValueOnce([browser, away]);
    renderSheet();

    const finding = await screen.findByTestId("deploy-finding-node");
    expect(finding.getAttribute("data-status")).toBe("unreachable");
    expect(finding.textContent).toContain("its runtime server on “node” is not running");
    expect(coordinatorRow().disabled).toBe(true);
    fireEvent.click(coordinatorRow());
    expect(deployBoard).not.toHaveBeenCalled();

    // The server started meanwhile.
    fireEvent.click(screen.getByText("Check again"));
    await waitFor(() =>
      expect(
        screen.getByTestId("deploy-finding-node").getAttribute("data-status"),
      ).toBe("ready"),
    );
    expect(checkDeploy).toHaveBeenCalledTimes(2);
    expect(coordinatorRow().disabled).toBe(false);
  });

  it("shows what changed since the check when the deploy itself is stopped", async () => {
    vi.mocked(deployBoard).mockRejectedValueOnce(
      new DeployPreflightError([browser, away]),
    );
    const onDeployed = renderSheet();

    await waitFor(() => expect(coordinatorRow().disabled).toBe(false));
    fireEvent.click(coordinatorRow());

    await waitFor(() =>
      expect(
        screen.getByTestId("deploy-finding-node").getAttribute("data-status"),
      ).toBe("unreachable"),
    );
    expect(onDeployed).not.toHaveBeenCalled();
    expect(coordinatorRow().disabled).toBe(true);
  });
});
