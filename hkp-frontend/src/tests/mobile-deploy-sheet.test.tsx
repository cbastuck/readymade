import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DeployBoardSheet from "../views/playground/mobile/DeployBoardSheet";
import { MobileConnectionsProvider } from "../views/playground/mobile/MobileConnections";
import { deployBoard } from "../core/deploy";

const user = { userId: "user-1", idToken: "token", username: "someone" };

// The sheet only needs the board's deployable surface (name, serialize,
// hand-over) and the logged-in user; the real providers bring a whole board
// engine with them.
const boardContext = {
  boardName: "Voice Notes",
  serializeBoard: async () => ({ boardName: "Voice Notes" }),
  handOverRuntimes: vi.fn(),
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

vi.mock("../core/deploy", () => ({
  deployBoard: vi.fn(async () => "Voice Notes"),
}));

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

describe("mobile deploy sheet", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("lists the configured coordinators for the open board", () => {
    renderSheet();

    expect(screen.getByText("Voice Notes", { exact: false })).toBeTruthy();
    expect(screen.getByText("Cloud")).toBeTruthy();
    expect(screen.getByText(COORDINATOR.url)).toBeTruthy();
  });

  it("deploys to the chosen coordinator and hands the board back to attach to", async () => {
    const onDeployed = renderSheet();

    fireEvent.click(screen.getByText("Cloud"));

    await waitFor(() => {
      expect(deployBoard).toHaveBeenCalledWith(boardContext, COORDINATOR, user);
    });
    await waitFor(() => {
      expect(onDeployed).toHaveBeenCalledWith(COORDINATOR, "Voice Notes");
    });
  });
});
