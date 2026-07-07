/**
 * HTTP Uploader Token Injector tests
 *
 * Covers:
 *  - Mints a token (via app.mintToken) scoped to the uploader's target runtime
 *    and writes it into the uploader's authToken state
 *  - Passes the board through untouched when the host can't mint (plain web)
 *  - Never mutates the input board (clones)
 *  - Leaves authToken unset when minting fails/returns null (graceful)
 *  - Reuses one token across multiple uploaders targeting the same runtime
 */

import { describe, it, expect, vi } from "vitest";
import HttpUploaderTokenInjectorDescriptor from "../HttpUploaderTokenInjector";

type MintToken = (request: {
  action: "processRuntime";
  runtimeId: string;
}) => Promise<string | null>;

function createInjector(mintToken?: MintToken) {
  const app = { notify: vi.fn(), next: vi.fn(), mintToken };
  const service = HttpUploaderTokenInjectorDescriptor.create(
    app as any,
    "test-board",
    {} as any,
    "inj-1",
  ) as any;
  return { service, app };
}

function boardWithUploader(url = "HKP_RUNTIME_URL/runtimes/upload-server") {
  return {
    boardName: "Phone",
    runtimes: [{ id: "phone-ui", name: "Phone UI", type: "browser" }],
    services: {
      "phone-ui": [
        { uuid: "img", serviceId: "hookup.to/service/image-picker" },
        {
          uuid: "up",
          serviceId: "hookup.to/service/http-uploader",
          state: { url },
        },
      ],
    },
  };
}

const uploaderOf = (board: any) => board.services["phone-ui"][1];

describe("HttpUploaderTokenInjector", () => {
  it("mints a token scoped to the uploader's runtime and injects it", async () => {
    const mint = vi.fn(async () => "tok-123");
    const { service } = createInjector(mint);

    const out = await service.process(boardWithUploader());

    // Minted for exactly this runtime, extracted from the uploader URL.
    expect(mint).toHaveBeenCalledTimes(1);
    expect(mint).toHaveBeenCalledWith({
      action: "processRuntime",
      runtimeId: "upload-server",
    });
    expect(uploaderOf(out).state.authToken).toBe("tok-123");
  });

  it("passes the board through untouched when the host can't mint", async () => {
    // No mintToken on the app (plain web platform).
    const { service } = createInjector(undefined);

    const out = await service.process(boardWithUploader());

    expect(uploaderOf(out).state.authToken).toBeUndefined();
  });

  it("does not mutate the input board", async () => {
    const { service } = createInjector(async () => "tok-123");

    const input = boardWithUploader();
    await service.process(input);

    expect(uploaderOf(input).state.authToken).toBeUndefined();
  });

  it("leaves authToken unset when minting returns null", async () => {
    const { service } = createInjector(async () => null);

    const out = await service.process(boardWithUploader());

    expect(uploaderOf(out).state.authToken).toBeUndefined();
  });

  it("leaves authToken unset when minting throws", async () => {
    const { service } = createInjector(async () => {
      throw new Error("boom");
    });

    const out = await service.process(boardWithUploader());

    expect(uploaderOf(out).state.authToken).toBeUndefined();
  });

  it("reuses one token across uploaders targeting the same runtime", async () => {
    const mint = vi.fn(async () => "tok-123");
    const { service } = createInjector(mint);

    const board = boardWithUploader();
    // A second uploader to the same runtime.
    board.services["phone-ui"].push({
      uuid: "up2",
      serviceId: "hookup.to/service/http-uploader",
      state: { url: "HKP_RUNTIME_URL/runtimes/upload-server" },
    } as any);

    const out = await service.process(board);

    expect(mint).toHaveBeenCalledTimes(1);
    expect(out.services["phone-ui"][1].state.authToken).toBe("tok-123");
    expect(out.services["phone-ui"][2].state.authToken).toBe("tok-123");
  });
});
