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

// How long to keep asking for a token before emitting the board without one,
// and how long to wait between asks. Long enough to cover a runtime still being
// provisioned on a cold board load, short enough that a runtime that is never
// coming still yields a board rather than a hang.
const MINT_WAIT_MS = 10_000;
const MINT_RETRY_MS = 250;

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

  /**
   * Asks for a token, waiting for the target runtime to exist.
   *
   * A host only mints a grant for a runtime it is actually running, so that a
   * token can never name an endpoint nothing answers on. A board restores all
   * its runtimes concurrently, and this service runs in a browser runtime whose
   * services are configured without a single network round-trip, while the
   * runtime it mints for is provisioned over several — so on a first load the
   * ask reliably arrives before the runtime it names.
   *
   * Retrying is what closes that gap. It costs a short delay in the emitted
   * board, which is the QR appearing a moment later; giving up instead costs an
   * unauthorized transfer, and one that only shows up on the far device.
   */
  private async mintToken(
    mint: NonNullable<AppInstance["mintToken"]>,
    runtimeId: string,
  ): Promise<string | null> {
    const deadline = Date.now() + MINT_WAIT_MS;
    for (;;) {
      try {
        const token = await mint({ action: "processRuntime", runtimeId });
        if (token) {
          return token;
        }
      } catch (err: any) {
        // Leave the uploader without a token: the transfer will fail auth
        // exactly as it did before, which is no worse than not injecting.
        console.error("HttpUploaderTokenInjector: failed to mint token", err);
        return null;
      }
      if (Date.now() >= deadline) {
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, MINT_RETRY_MS));
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
