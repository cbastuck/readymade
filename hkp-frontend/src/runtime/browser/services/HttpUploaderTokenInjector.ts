import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import { collectServicesById, deepClone } from "../../board/traversal";
import { runtimeIdFromUrl } from "../../board/runtimeUrl";

/**
 * Service ID: hookup.to/service/http-uploader-token-injector
 *
 * The companion of the HTTP Uploader service. It takes no configuration of its
 * own — its whole job is to bake scoped, short-lived capability tokens into a
 * board before it is handed to another device (e.g. a DropIt phone via a QR
 * code), one token per HTTP Uploader found in the board.
 *
 * It scans the incoming board for HTTP Uploader services, and for each one asks
 * the host to mint a token scoped to exactly that uploader's target runtime
 * (POST /runtimes/<id>) via `app.mintToken`. The token is written into the
 * uploader's `authToken` state so the receiving device can push to that one
 * runtime, and nothing else. A leaked or sniffed token self-expires quickly and
 * cannot drive the wider API.
 *
 * The mint transport lives in the host platform layer (it reaches the embedded
 * runtime over the hkp:// scheme); on a plain browser `mintToken` is absent, so
 * the board passes through untouched.
 *
 * IO: in = board descriptor -> out = same board with authTokens injected.
 */

const serviceId = "hookup.to/service/http-uploader-token-injector";
const serviceName = "HTTP Uploader Token Injector";

const UPLOADER_SERVICE_ID = "hookup.to/service/http-uploader";

type State = Record<string, never>;

class HttpUploaderTokenInjector extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {});
  }

  async configure(_config: any) {
    // No configurable state — the service is a stateless board transform.
  }

  async process(board: any): Promise<any> {
    const mint = this.app.mintToken;
    if (!mint || !board || typeof board !== "object") {
      // Not on a host that can mint (or nothing to inject into): pass through.
      return board;
    }

    // Clone so we never mutate the upstream service's emitted descriptor.
    const result = deepClone(board);

    const uploaders = collectServicesById(result, UPLOADER_SERVICE_ID).filter(
      (node) => node.state && typeof node.state.url === "string",
    );
    if (uploaders.length === 0) {
      return result;
    }

    // One token per distinct target runtime, reused across uploaders/chunks.
    const tokenByRuntime = new Map<string, string | null>();

    for (const uploader of uploaders) {
      const runtimeId = runtimeIdFromUrl(uploader.state.url);
      if (!runtimeId) {
        continue;
      }

      let token = tokenByRuntime.get(runtimeId);
      if (token === undefined) {
        token = await this.mintToken(mint, runtimeId);
        tokenByRuntime.set(runtimeId, token);
      }
      if (token) {
        uploader.state.authToken = token;
      } else {
        console.error(
          `HttpUploaderTokenInjector: no token for runtime "${runtimeId}" — upload will be unauthorized`,
        );
      }
    }

    return result;
  }

  private async mintToken(
    mint: NonNullable<AppInstance["mintToken"]>,
    runtimeId: string,
  ): Promise<string | null> {
    try {
      return await mint({ action: "processRuntime", runtimeId });
    } catch (err: any) {
      // Leave the uploader without a token: the transfer will fail auth exactly
      // as it did before, which is no worse than not injecting.
      console.error("HttpUploaderTokenInjector: failed to mint token", err);
      return null;
    }
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new HttpUploaderTokenInjector(app, board, descriptor, id),
};

export default descriptor;
