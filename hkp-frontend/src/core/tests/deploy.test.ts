import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DeployIntroductionError,
  deployBoard,
  describeDeploy,
} from "../deploy";
import { RuntimePreflight } from "../deployPreflight";
import { BoardDescriptor } from "../../types";

const events: string[] = [];

const registerCoordinatorBoard = vi.fn();
const requestCoordinatorTickets = vi.fn();
vi.mock("../../views/cloud/coordinatorClient", () => ({
  registerCoordinatorBoard: (...args: unknown[]) =>
    registerCoordinatorBoard(...args),
  requestCoordinatorTickets: (...args: unknown[]) =>
    requestCoordinatorTickets(...args),
}));

const introduceRuntimeServer = vi.fn();
const secretsFor = vi.fn();
vi.mock("../../runtime/rest/RuntimeRestApi", () => ({
  introduceRuntimeServer: (...args: unknown[]) =>
    introduceRuntimeServer(...args),
  secretsFor: (...args: unknown[]) => secretsFor(...args),
}));

const preflightBoard = vi.fn();
vi.mock("../deployPreflight", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../deployPreflight")>()),
  preflightBoard: (...args: unknown[]) => preflightBoard(...args),
}));

/**
 * Handing a board to a coordinator.
 *
 * The order is the substance. Everything that can fail is done while this
 * browser still owns the board — the check, the tickets, the runtime servers
 * connecting to the coordinator — and only then are the runtimes given up,
 * before the coordinator is asked to build them under the same ids.
 */

const coordinator = { name: "Home", url: "http://127.0.0.1:8080/coordinator" };
const user = { userId: "user-1", idToken: "token-1" };

const board = {
  boardName: "Doorbell",
  runtimes: [
    { id: "ui", name: "Browser", type: "browser" },
    { id: "node", name: "Node", type: "rest", remote: "Laptop" },
  ],
  services: { ui: [], node: [{ uuid: "m", serviceId: "monitor" }] },
} as unknown as BoardDescriptor;

const ready: RuntimePreflight[] = [
  { runtimeId: "ui", name: "Browser", status: "transient" },
  {
    runtimeId: "node",
    name: "Node",
    status: "ready",
    url: "http://laptop:8080",
    mode: "remote",
    remoteName: "Laptop",
  },
];

const remotes = [{ name: "Laptop", type: "rest", url: "http://laptop:8080" }];

function deployable(overrides: Record<string, unknown> = {}) {
  return {
    boardName: "Doorbell",
    serializeBoard: vi.fn(async () => {
      events.push("serialize");
      return board;
    }),
    handOverRuntimes: vi.fn(() => events.push("hand over")),
    availableRuntimeEngines: remotes,
    ...overrides,
  };
}

beforeEach(() => {
  events.length = 0;
  registerCoordinatorBoard.mockReset();
  registerCoordinatorBoard.mockImplementation(async () => {
    events.push("register");
    return { status: "running", errors: [] };
  });
  requestCoordinatorTickets.mockReset();
  requestCoordinatorTickets.mockImplementation(async () => {
    events.push("tickets");
    return { node: "hkpt_node" };
  });
  introduceRuntimeServer.mockReset();
  introduceRuntimeServer.mockImplementation(async () => {
    events.push("introduce");
  });
  secretsFor.mockReset();
  secretsFor.mockResolvedValue({});
  preflightBoard.mockReset();
  preflightBoard.mockImplementation(async () => {
    events.push("preflight");
    return ready;
  });
});

describe("deploying a board", () => {
  it("checks, introduces and only then gives the runtimes up, before the coordinator builds them", async () => {
    // Reversed at the end, a navigation landing between the two would delete
    // the board that was just deployed — the ids are the same on both sides.
    await deployBoard(deployable(), coordinator, user);

    expect(events).toEqual([
      "serialize",
      "preflight",
      "tickets",
      "introduce",
      "hand over",
      "register",
    ]);
  });

  it("resolves the board against the runtime servers this client keeps", async () => {
    await deployBoard(deployable(), coordinator, user);

    expect(preflightBoard).toHaveBeenCalledWith(board, remotes, user);
  });

  it("asks for a ticket per remote runtime, and none for a browser", async () => {
    await deployBoard(deployable(), coordinator, user);

    expect(requestCoordinatorTickets).toHaveBeenCalledWith(
      coordinator.url,
      "user-1",
      "token-1",
      "Doorbell",
      ["node"],
    );
  });

  it("tells each runtime server where the coordinator is and hands it its ticket", async () => {
    await deployBoard(deployable(), coordinator, user);

    // At the address the name resolved to — which the coordinator is never told.
    expect(introduceRuntimeServer).toHaveBeenCalledWith(
      "http://laptop:8080",
      user,
      {
        coordinatorUrl: coordinator.url,
        ticket: "hkpt_node",
        boardName: "Doorbell",
        runtimeId: "node",
        secrets: {},
      },
    );
  });

  it("registers the board as authored: the name it gave, and no address", async () => {
    await deployBoard(deployable(), coordinator, user);

    const registered = registerCoordinatorBoard.mock.calls[0][3];
    expect(registered).toEqual({ ...board, boardName: "Doorbell" });
    expect(JSON.stringify(registered)).not.toContain("http://laptop:8080");
    expect(JSON.stringify(registered)).not.toContain("hkpt_");
  });

  it("deploys under the name the board carries when it has none of its own", async () => {
    const { boardName } = await deployBoard(
      deployable({ boardName: undefined }),
      coordinator,
      user,
    );

    expect(boardName).toBe("Doorbell");
  });

  it("asks nobody for tickets when the board has only browser runtimes", async () => {
    preflightBoard.mockResolvedValue([ready[0]]);

    await deployBoard(deployable(), coordinator, user);

    expect(requestCoordinatorTickets).not.toHaveBeenCalled();
    expect(introduceRuntimeServer).not.toHaveBeenCalled();
    expect(registerCoordinatorBoard).toHaveBeenCalled();
  });
});

describe("a deploy that cannot go ahead", () => {
  it("does not give up the runtimes when there is no board to deploy", async () => {
    // Nothing was handed over, so this browser is still the owner and must
    // still clean up after itself.
    const subject = deployable({ serializeBoard: async () => null });

    await expect(deployBoard(subject, coordinator, user)).rejects.toThrow(
      /serialize/,
    );
    expect(subject.handOverRuntimes).not.toHaveBeenCalled();
    expect(registerCoordinatorBoard).not.toHaveBeenCalled();
  });

  it("does not give up the runtimes when a runtime would not come up", async () => {
    // Found before the handover, a problem is one the person can still fix
    // from a board they own. Found after it, the board is half-deployed.
    const subject = deployable();
    preflightBoard.mockResolvedValue([
      { runtimeId: "node", name: "Node", status: "unreachable" },
    ]);

    await expect(deployBoard(subject, coordinator, user)).rejects.toThrow(
      /“Node”: its runtime server is not running/,
    );
    expect(subject.handOverRuntimes).not.toHaveBeenCalled();
    expect(requestCoordinatorTickets).not.toHaveBeenCalled();
    expect(registerCoordinatorBoard).not.toHaveBeenCalled();
  });

  it("does not give up the runtimes when a runtime server cannot connect to the coordinator", async () => {
    const subject = deployable();
    introduceRuntimeServer.mockRejectedValue(
      new Error("its runtime server could not connect to the coordinator — refused"),
    );

    const failure = await deployBoard(subject, coordinator, user).catch(
      (err) => err,
    );

    expect(failure).toBeInstanceOf(DeployIntroductionError);
    expect(failure.runtimeId).toBe("node");
    expect(failure.message).toBe(
      "“Node”: its runtime server could not connect to the coordinator — refused",
    );
    expect(subject.handOverRuntimes).not.toHaveBeenCalled();
    expect(registerCoordinatorBoard).not.toHaveBeenCalled();
  });

  it("does not give up the runtimes when the coordinator issues no tickets", async () => {
    const subject = deployable();
    requestCoordinatorTickets.mockRejectedValue(new Error("needs updating"));

    await expect(deployBoard(subject, coordinator, user)).rejects.toThrow(
      /needs updating/,
    );
    expect(introduceRuntimeServer).not.toHaveBeenCalled();
    expect(subject.handOverRuntimes).not.toHaveBeenCalled();
  });
});

describe("credentials for a deployed board", () => {
  it("go to the runtime server the name resolved to, with consent asked for that address", async () => {
    // A remote's name is the board's to choose and resolves differently for
    // everyone, so it is never what a grant is keyed on.
    secretsFor.mockResolvedValue({ "imap.password": { value: "s3cret" } });

    await deployBoard(deployable(), coordinator, user);

    expect(secretsFor).toHaveBeenCalledWith(board.services.node, {
      boardName: "Doorbell",
      runtimeId: "node",
      runtimeName: "Node",
      url: "http://laptop:8080",
    });
    expect(introduceRuntimeServer.mock.calls[0][2].secrets).toEqual({
      "imap.password": { value: "s3cret" },
    });
  });

  it("never reach the coordinator", async () => {
    secretsFor.mockResolvedValue({ "imap.password": { value: "s3cret" } });

    await deployBoard(deployable(), coordinator, user);

    expect(JSON.stringify(registerCoordinatorBoard.mock.calls)).not.toContain(
      "s3cret",
    );
    expect(JSON.stringify(requestCoordinatorTickets.mock.calls)).not.toContain(
      "s3cret",
    );
  });

  it("are asked about one runtime at a time", async () => {
    // Releasing may put a question to the person; two at once is one too many.
    preflightBoard.mockResolvedValue([
      { ...ready[1], runtimeId: "a", name: "A" },
      { ...ready[1], runtimeId: "b", name: "B" },
    ]);
    requestCoordinatorTickets.mockResolvedValue({ a: "hkpt_a", b: "hkpt_b" });
    let asking = 0;
    let most = 0;
    secretsFor.mockImplementation(async () => {
      asking += 1;
      most = Math.max(most, asking);
      await new Promise((resolve) => setTimeout(resolve, 5));
      asking -= 1;
      return {};
    });

    await deployBoard(deployable(), coordinator, user);

    expect(most).toBe(1);
  });
});

describe("what a person is told afterwards", () => {
  it("is what the coordinator made of the board, not that it runs", async () => {
    registerCoordinatorBoard.mockResolvedValue({
      status: "error",
      errors: ['Runtime "node" is not connected'],
    });

    const result = await deployBoard(deployable(), coordinator, user);

    expect(result).toMatchObject({
      boardName: "Doorbell",
      status: "error",
      errors: ['Runtime "node" is not connected'],
    });
    const outcome = describeDeploy(result, "Home");
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toMatch(
      /did not fully start — Runtime "node" is not connected/,
    );
  });

  it("names the remote a requirement was placed on", async () => {
    // With two servers that would do, the choice was this client's — so it is
    // said rather than left to be discovered.
    preflightBoard.mockResolvedValue([
      { ...ready[1], mode: "requires", remoteName: "Studio" },
    ]);

    const result = await deployBoard(deployable(), coordinator, user);

    expect(describeDeploy(result, "Home").message).toBe(
      "“Doorbell” is running on Home — “Node” on “Studio”",
    );
  });

  it("does not name a remote the board named itself", async () => {
    const result = await deployBoard(deployable(), coordinator, user);

    expect(describeDeploy(result, "Home").message).toBe(
      "“Doorbell” is running on Home",
    );
  });
});
