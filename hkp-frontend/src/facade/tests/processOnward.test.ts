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

function playground(answer: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(answer, { status: 200 })),
  );
  const onResult = vi.fn(async () => {});
  const scope = {
    descriptor: { id: "forget", url: "http://127.0.0.1:8080" },
    authenticatedUser: null,
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
    expect(onResult).toHaveBeenCalledWith(null, { deleted: true }, null);
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/runtimes/forget/services/forget-which/process",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ slug: "a" }) }),
    );
  });

  it("passes nothing on when the pipeline stopped", async () => {
    const { context, onResult } = playground("null");

    processService(context, "forget-which", {});

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onResult).not.toHaveBeenCalled();
  });
});
