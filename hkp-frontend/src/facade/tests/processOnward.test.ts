import { afterEach, describe, expect, it, vi } from "vitest";

import restApi from "../../runtime/rest/RuntimeRestApi";
import { processService } from "../boardServices";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";

/**
 * A facade's process action on a runtime the playground reaches over REST.
 *
 * A button beginning at a service is a run, and a run does not stop at the
 * runtime it began in: a Remove in one runtime is what makes the next one
 * redraw the list. Over REST the runtime answers the request and sends
 * nothing over its socket, so the answer has to be passed on from here — or
 * the next runtime only hears of it on its own next tick.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

const ANNA = {
  username: "anna",
  userId: "auth0|anna",
  email: "anna@example.com",
  features: {},
  idToken: "token",
};

function playground(answer: string, user: typeof ANNA | null = ANNA) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(answer, { status: 200 })),
  );
  const onResult = vi.fn(async () => {});
  const scope = {
    descriptor: { id: "forget", url: "http://127.0.0.1:8080" },
    authenticatedUser: user,
    onResult,
  };
  const context = {
    scopes: { forget: scope },
    services: { forget: [{ uuid: "forget-which", serviceId: "map", state: {} }] },
    runtimes: [
      { id: "forget", name: "Forget", type: "rest", url: "http://127.0.0.1:8080" },
    ],
    runtimeApis: { rest: restApi },
  } as unknown as BoardContextState;
  return { context, onResult };
}

describe("a process action on a REST runtime", () => {
  it("passes what the pipeline produced on to the next runtime", async () => {
    const { context, onResult } = playground(JSON.stringify({ deleted: true }));

    processService(context, "forget-which", { slug: "a" });

    await vi.waitFor(() => expect(onResult).toHaveBeenCalledOnce());
    expect(onResult).toHaveBeenCalledWith(null, { deleted: true }, expect.anything());
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/runtimes/forget/services/forget-which/process",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ slug: "a" }) }),
    );
  });

  it("goes on as the run of whoever pressed the button", async () => {
    // Not as the board's: a board reads a result that names no run as
    // something the runtime did by itself, and the services after it would
    // see a board action where a person acted.
    const { context, onResult } = playground(JSON.stringify({ deleted: true }));

    processService(context, "forget-which", { slug: "a" });

    await vi.waitFor(() => expect(onResult).toHaveBeenCalledOnce());
    const [, , run] = onResult.mock.calls[0] as unknown as [unknown, unknown, any];
    expect(run.actor).toMatchObject({
      kind: "person",
      sub: "auth0|anna",
      email: "anna@example.com",
      name: "anna",
    });
  });

  it("goes on as a local run when nobody is signed in", async () => {
    const { context, onResult } = playground(JSON.stringify({ deleted: true }), null);

    processService(context, "forget-which", { slug: "a" });

    await vi.waitFor(() => expect(onResult).toHaveBeenCalledOnce());
    const [, , run] = onResult.mock.calls[0] as unknown as [unknown, unknown, any];
    expect(run.actor).toEqual({ kind: "local" });
  });

  it("passes nothing on when the pipeline stopped", async () => {
    const { context, onResult } = playground("null");

    processService(context, "forget-which", {});

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onResult).not.toHaveBeenCalled();
  });
});
