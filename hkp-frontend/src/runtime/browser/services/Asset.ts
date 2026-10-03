/**
 * Service Documentation
 * Service ID: asset
 * Service Name: Asset
 * Modes: none
 * Key Config: asset (an `hkp-asset://<id>` reference)
 * IO: in=anything, or a reference naming another asset -> out={meta, body}
 *     for text, {meta, binary} otherwise
 *
 * Puts one of the board's assets into the pipeline, for any service that has no
 * way of its own to take one. A service that serves, plays or loads content
 * resolves a reference itself; everything else composes with this.
 *
 * The asset is resolved on every pass, against the board's `assets` as they are
 * then — the browser runtime's asset store is the board's own — so editing it
 * changes what the next pass carries without anything being reconfigured.
 *
 * The input can name the asset: a bare `hkp-asset://…` string, or an object
 * whose `asset` field is one, takes the place of the configured reference for
 * that pass. Any other input only triggers the pass.
 *
 * The answer is shaped like an HTTP response (`meta` with `status` and
 * `contentType`, beside `body` or `binary`), so an endpoint can hand it straight
 * back. An asset that does not resolve is answered with an error status and
 * reported, never passed on as its reference.
 *
 * Mirrors hkp-node's src/services/asset.ts.
 */
import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import AssetUI from "./AssetUI";
import { resolveAsset } from "../assetResolver";
import {
  isTextMediaType,
  parseAssetRef,
} from "hkp-frontend/src/runtime/board/assets";

const serviceId = "asset";
const serviceName = "Asset";

type State = {
  /** The reference this service emits when its input names none. */
  asset: string;
  mediaType: string;
  size: number;
  error: string;
};

/** The reference an input names, when it names one. */
function requestedReference(input: unknown): string | null {
  if (typeof input === "string" && parseAssetRef(input.trim())) {
    return input.trim();
  }
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const named = (input as { asset?: unknown }).asset;
    if (typeof named === "string" && parseAssetRef(named.trim())) {
      return named.trim();
    }
  }
  return null;
}

class Asset extends ServiceBase<State> {
  constructor(app: AppInstance, board: string, descriptor: ServiceClass, id: string) {
    super(app, board, descriptor, id, {
      asset: "",
      mediaType: "",
      size: 0,
      error: "",
    });
  }

  configure(config: any) {
    if (typeof config?.asset === "string") {
      this.state.asset = config.asset.trim();
      this.app.notify(this, { asset: this.state.asset });
    }
  }

  async process(params: any) {
    const reference = requestedReference(params) ?? this.state.asset;
    if (!reference) {
      return this.fail(400, "no asset is configured");
    }
    const { asset, problem } = await resolveAsset(this.app.assets?.() ?? [], reference);
    if (!asset) {
      return this.fail(404, problem);
    }

    this.state.error = "";
    this.state.mediaType = asset.mediaType;
    this.state.size = asset.bytes.length;
    this.app.notify(this, {
      error: "",
      mediaType: asset.mediaType,
      size: asset.bytes.length,
    });

    const meta = {
      status: 200,
      contentType: asset.mediaType,
      asset: asset.id,
      size: asset.bytes.length,
    };
    return isTextMediaType(asset.mediaType)
      ? { meta, body: new TextDecoder().decode(asset.bytes) }
      : { meta, binary: asset.bytes };
  }

  private fail(status: number, message: string) {
    this.state.error = message;
    this.app.notify(this, { error: message });
    return { meta: { status, contentType: "application/json" }, body: { error: message } };
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppInstance, board: string, descriptor: ServiceClass, id: string) =>
    new Asset(app, board, descriptor, id),
  createUI: AssetUI,
};

export default descriptor;
