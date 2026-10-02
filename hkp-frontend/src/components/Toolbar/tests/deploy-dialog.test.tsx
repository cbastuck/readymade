import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DeployDialog from "../DeployDialog";
import { RuntimePreflight } from "../../../core/deployPreflight";

const checkDeploy = vi.fn();
vi.mock("hkp-frontend/src/core/deploy", () => ({
  checkDeploy: (...args: unknown[]) => checkDeploy(...args),
}));

/**
 * What a person is shown before a board is handed over.
 *
 * The dialog is the last point at which the board is still theirs, so it is
 * where everything that would stop a deploy has to be said — per runtime, in
 * words they can act on — and where the Deploy button has to refuse.
 */

const coordinator = { name: "Cloud", url: "https://coord.example/coordinator" };
const user = { userId: "user-1", idToken: "token" };
const board = {
  boardName: "Doorbell",
  serializeBoard: async () => null,
};

const browser: RuntimePreflight = {
  runtimeId: "ui",
  name: "Browser",
  status: "transient",
};
const placed: RuntimePreflight = {
  runtimeId: "py",
  name: "Python",
  status: "ready",
  url: "http://studio:5000",
  mode: "remote",
  remoteName: "Studio",
};
const away: RuntimePreflight = {
  runtimeId: "node",
  name: "Node",
  status: "unreachable",
  mode: "remote",
  remoteName: "Laptop",
};

function renderDialog(overrides: Record<string, unknown> = {}) {
  const onDeploy = vi.fn();
  const onClose = vi.fn();
  render(
    <DeployDialog
      board={board}
      user={user}
      coordinator={coordinator}
      busy={false}
      onDeploy={onDeploy}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onDeploy, onClose };
}

const deployButton = () =>
  screen.getByRole("button", { name: "Deploy" }) as HTMLButtonElement;

beforeEach(() => {
  checkDeploy.mockReset();
});

describe("the deploy dialog", () => {
  it("says, per runtime, where it would run and that it can", async () => {
    checkDeploy.mockResolvedValue([browser, placed]);

    renderDialog();

    // The remote a name resolved to is said beside the runtime.
    expect(
      await screen.findByText("“Python” is ready on “Studio”"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "“Browser” runs in the browser, only while the board is open",
      ),
    ).toBeTruthy();
    expect(deployButton().disabled).toBe(false);
  });

  it("checks the board it was opened for, as the person", async () => {
    checkDeploy.mockResolvedValue([placed]);

    renderDialog();

    await waitFor(() => expect(checkDeploy).toHaveBeenCalledWith(board, user));
  });

  it("refuses to deploy while a runtime would not come up, and says which", async () => {
    checkDeploy.mockResolvedValue([placed, away]);

    const { onDeploy } = renderDialog();

    expect(
      await screen.findByText(
        "“Node”: its runtime server on “Laptop” is not running",
      ),
    ).toBeTruthy();
    expect(deployButton().disabled).toBe(true);
    fireEvent.click(deployButton());
    expect(onDeploy).not.toHaveBeenCalled();
  });

  it("does not offer Deploy before the check has answered", () => {
    checkDeploy.mockReturnValue(new Promise(() => {}));

    renderDialog();

    expect(screen.getByText("Checking the board’s runtimes…")).toBeTruthy();
    expect(deployButton().disabled).toBe(true);
  });

  it("checks again when asked, so a server that was started can be found", async () => {
    checkDeploy.mockResolvedValueOnce([away]);
    checkDeploy.mockResolvedValueOnce([{ ...away, status: "ready" }]);

    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "Check again" }));

    expect(
      await screen.findByText("“Node” is ready on “Laptop”"),
    ).toBeTruthy();
    expect(deployButton().disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "Check again" })).toBeNull();
  });

  it("deploys to the coordinator it was opened for", async () => {
    checkDeploy.mockResolvedValue([placed]);
    const { onDeploy } = renderDialog();
    await screen.findByText("“Python” is ready on “Studio”");

    fireEvent.click(deployButton());

    expect(onDeploy).toHaveBeenCalledWith(coordinator);
  });

  it("shows what went wrong deploying and stays open to try again", async () => {
    checkDeploy.mockResolvedValue([placed]);

    renderDialog({
      error: "Deploy failed — “Python”: its runtime server refused (403)",
    });

    expect(
      await screen.findByText(
        "Deploy failed — “Python”: its runtime server refused (403)",
      ),
    ).toBeTruthy();
    expect(deployButton().disabled).toBe(false);
  });

  it("says so when the board could not be checked at all", async () => {
    checkDeploy.mockRejectedValue(new Error("Could not serialize the current board"));

    renderDialog();

    expect(
      await screen.findByText("Could not serialize the current board"),
    ).toBeTruthy();
    expect(deployButton().disabled).toBe(true);
  });

  it("waits while a deploy is under way", async () => {
    checkDeploy.mockResolvedValue([placed]);

    renderDialog({ busy: true });
    await screen.findByText("“Python” is ready on “Studio”");

    const busy = screen.getByRole("button", {
      name: "Deploying…",
    }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
  });

  it("is not there until a coordinator is chosen", () => {
    renderDialog({ coordinator: null });

    expect(screen.queryByTestId("deploy-dialog")).toBeNull();
    expect(checkDeploy).not.toHaveBeenCalled();
  });
});
