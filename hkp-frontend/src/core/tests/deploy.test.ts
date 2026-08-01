import { beforeEach, describe, expect, it, vi } from "vitest";

import { deployBoard } from "../deploy";
import { BoardDescriptor } from "../../types";

const registerCoordinatorBoard = vi.fn(async () => ({}) as never);
vi.mock("../../views/cloud/coordinatorClient", () => ({
  registerCoordinatorBoard: (...args: unknown[]) =>
    registerCoordinatorBoard(...(args as [])),
}));

/**
 * Handing a board to a coordinator.
 *
 * The order is the substance: the runtimes are given up before the coordinator
 * is asked to provision them, because from that request onward they are its
 * runtimes under ids this browser also knows.
 */

const coordinator = { name: "Home", url: "http://127.0.0.1:8080/coordinator" };
const user = { userId: "user-1", idToken: "token-1" };

const board = {
  boardName: "Doorbell",
  runtimes: [{ id: "node", name: "Node", type: "rest" }],
  services: {},
} as unknown as BoardDescriptor;

function deployable(overrides: Record<string, unknown> = {}) {
  const events: string[] = [];
  const subject = {
    boardName: "Doorbell",
    serializeBoard: vi.fn(async () => {
      events.push("serialize");
      return board;
    }),
    handOverRuntimes: vi.fn(() => events.push("hand over")),
    ...overrides,
  };
  registerCoordinatorBoard.mockImplementation(async () => {
    events.push("register");
    return {} as never;
  });
  return { subject, events };
}

beforeEach(() => {
  registerCoordinatorBoard.mockReset();
});

describe("deploying a board", () => {
  it("gives up the runtimes before the coordinator provisions them", async () => {
    // Reversed, a navigation landing between the two would delete the board
    // that was just deployed — the ids are the same on both sides.
    const { subject, events } = deployable();

    await deployBoard(subject, coordinator, user);

    expect(events).toEqual(["serialize", "hand over", "register"]);
  });

  it("registers the board as the user with the chosen coordinator", async () => {
    const { subject } = deployable();

    await deployBoard(subject, coordinator, user);

    expect(registerCoordinatorBoard).toHaveBeenCalledWith(
      coordinator.url,
      user.userId,
      user.idToken,
      { ...board, boardName: "Doorbell" },
    );
  });

  it("deploys under the name the board carries when it has none of its own", async () => {
    const { subject } = deployable({ boardName: undefined });

    const name = await deployBoard(subject, coordinator, user);

    expect(name).toBe("Doorbell");
  });

  it("does not give up the runtimes when there is no board to deploy", async () => {
    // Nothing was handed over, so this browser is still the owner and must
    // still clean up after itself.
    const { subject } = deployable({ serializeBoard: async () => null });

    await expect(deployBoard(subject, coordinator, user)).rejects.toThrow(
      /serialize/,
    );
    expect(subject.handOverRuntimes).not.toHaveBeenCalled();
    expect(registerCoordinatorBoard).not.toHaveBeenCalled();
  });
});
