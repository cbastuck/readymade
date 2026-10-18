import { BoardDescriptor, RuntimeClass } from "../types";
import { remoteNameForBoard } from "../runtime/board/remote";
import { validateAssistBoard } from "./validation";

/**
 * What Board Assist may change, and therefore what it is shown.
 *
 * With a runtime selected, the model sees that runtime in full and the rest of
 * the board only as an outline, and proposes that runtime alone; the proposal
 * is merged into the current board here. That keeps everything else out of
 * the request, and makes "only this runtime" a property of the result rather
 * than a request a model may ignore — smaller models in particular rewrite
 * whatever whole board they are handed.
 */
export type AssistScope =
  | { kind: "board" }
  | { kind: "runtime"; runtimeId: string; runtimeName: string };

type Json = Record<string, unknown>;
type AssetLike = Json & { id?: unknown };

function object(value: unknown): value is Json {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * The scope a context choice resolves to on this board. A runtime contributed
 * by an imported unit is not in the root document and cannot be edited
 * through it, so selecting one falls back to the whole board.
 */
export function resolveAssistScope(
  config: BoardDescriptor,
  choice: string,
  selectedRuntimeId: string | null | undefined,
): AssistScope {
  if (choice === "board" || !selectedRuntimeId) return { kind: "board" };
  const runtime = config.runtimes.find((rt) => rt.id === selectedRuntimeId);
  return runtime
    ? { kind: "runtime", runtimeId: runtime.id, runtimeName: runtime.name }
    : { kind: "board" };
}

/** An asset descriptor as the model sees it when contents are left out. */
function withoutContent(asset: unknown): unknown {
  if (!object(asset) || (asset.text === undefined && asset.base64 === undefined))
    return asset;
  const { text: _text, base64: _base64, ...rest } = asset;
  return { ...rest, contentOmitted: true };
}

function assetsFor(assets: unknown, includeContents: boolean): unknown {
  if (!Array.isArray(assets) || includeContents) return assets;
  return assets.map(withoutContent);
}

function stringsIn(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") into.push(value);
  else if (Array.isArray(value)) value.forEach((item) => stringsIn(item, into));
  else if (object(value)) Object.values(value).forEach((item) => stringsIn(item, into));
  return into;
}

function blockUses(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => blockUses(item, into));
  else if (object(value)) {
    if (typeof value.block === "string") into.add(value.block);
    Object.values(value).forEach((item) => blockUses(item, into));
  }
  return into;
}

function facadeServiceUuids(facade: unknown): string[] {
  const uuids = new Set<string>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (object(value)) {
      if (typeof value.serviceUuid === "string") uuids.add(value.serviceUuid);
      Object.values(value).forEach(visit);
    }
  };
  visit(facade);
  return [...uuids];
}

export type ContextOptions = {
  includeAssetContents: boolean;
  units: Array<{ uri: string; board: unknown }>;
  selectedServiceUuids: string[];
  openNestedPipeline: unknown[];
  availableRuntimeEngines: RuntimeClass[];
  serviceCatalog: unknown;
};

/**
 * The runtime servers this client keeps, as a board refers to them: by name,
 * never by address. The name is the most portable one each answers to
 * (`embedded`, a shared name such as `node`, else the one it is listed under).
 * Addresses are left out so the model has none to copy into a board — and so
 * the person's server addresses are not sent to the provider at all.
 */
export function runtimeServers(engines: RuntimeClass[]) {
  return engines.map((engine) =>
    engine.url
      ? {
          type: engine.type,
          remote: remoteNameForBoard(engines, engine.url) ?? engine.name,
          ...(engine.aliases?.length ? { aliases: engine.aliases } : {}),
        }
      : { type: engine.type, name: engine.name },
  );
}

/** The board context sent with a request, limited to what the scope needs. */
export function assistContext(
  config: BoardDescriptor,
  scope: AssistScope,
  options: ContextOptions,
): Json {
  const units = options.units.map((unit) => ({
    ...unit,
    board: object(unit.board)
      ? {
          ...unit.board,
          assets: assetsFor(unit.board.assets, options.includeAssetContents),
        }
      : unit.board,
  }));
  const shared = {
    assetContents: options.includeAssetContents ? "included" : "omitted",
    selectedServiceUuids: options.selectedServiceUuids,
    openNestedPipeline: options.openNestedPipeline,
    runtimeServers: runtimeServers(options.availableRuntimeEngines),
    serviceCatalog: options.serviceCatalog,
  };
  if (scope.kind === "board")
    return {
      scope: "board",
      board: {
        ...config,
        assets: assetsFor(config.assets, options.includeAssetContents),
      },
      importedUnitDocuments: units,
      ...shared,
    };

  const runtime = config.runtimes.find((rt) => rt.id === scope.runtimeId)!;
  const services = config.services[scope.runtimeId] ?? [];
  const references = stringsIn(services);
  const usedBlocks = blockUses(services);
  const blocks = Array.isArray(config.blocks)
    ? config.blocks.filter(
        (block) => object(block) && usedBlocks.has(String(block.id)),
      )
    : [];
  const assets = Array.isArray(config.assets)
    ? (config.assets as AssetLike[]).filter((asset) =>
        references.some((text) => text.includes(`hkp-asset://${asset.id}`)),
      )
    : [];
  return {
    scope: "runtime",
    editableRuntime: runtime,
    editableServices: services,
    boardOutline: {
      boardName: config.boardName,
      runtimes: config.runtimes.map((rt) => ({
        id: rt.id,
        name: rt.name,
        type: rt.type,
        ...(rt.remote ? { remote: rt.remote } : {}),
        services: (config.services[rt.id] ?? []).map((svc) => ({
          uuid: svc.uuid,
          serviceId: svc.serviceId,
          serviceName: svc.serviceName,
        })),
      })),
      facadeServiceUuids: facadeServiceUuids(config.facade),
    },
    referencedBlocks: blocks,
    referencedAssets: assetsFor(assets, options.includeAssetContents),
    importedUnitDocuments: units.filter((unit) =>
      references.some((text) => text.includes(unit.uri)),
    ),
    ...shared,
  };
}

/** Says what the model may change, beside the request. */
export function scopeInstruction(scope: AssistScope): string {
  return scope.kind === "board"
    ? "Editing scope: the whole board."
    : `Editing scope: only runtime '${scope.runtimeId}' (${scope.runtimeName}). Its descriptor and services are in editableRuntime and editableServices; the rest of the board is an outline you cannot change. Propose only this runtime, keeping its id. Keep services whose uuids are in facadeServiceUuids unless the person asks otherwise. If the request needs changes to other runtimes, the facade, assets or blocks, propose nothing and ask the person to switch the context to Whole board.`;
}

/**
 * Asset contents the model was not shown come back from the current board.
 * A descriptor still marked as omitted, or one with no content at all, is the
 * model keeping that asset; one with new content is an edit; an asset left
 * out of the list is a removal. A proposal without an assets list keeps them.
 */
function restoreAssets(base: BoardDescriptor, board: BoardDescriptor) {
  const current = new Map(
    ((base.assets ?? []) as AssetLike[]).map((asset) => [asset.id, asset]),
  );
  if (!Array.isArray(board.assets))
    return base.assets ? { ...board, assets: base.assets } : board;
  return {
    ...board,
    assets: (board.assets as AssetLike[]).map((asset) => {
      if (!object(asset)) return asset;
      const { contentOmitted, ...rest } = asset;
      const kept =
        contentOmitted ||
        (rest.text === undefined &&
          rest.base64 === undefined &&
          rest.url === undefined);
      return kept && current.has(asset.id) ? current.get(asset.id)! : rest;
    }),
  } as BoardDescriptor;
}

/**
 * Turns what the model proposed into the complete board to review. Errors are
 * written for the model, which gets them back as the tool result.
 */
export function resolveAssistProposal(
  scope: AssistScope,
  base: BoardDescriptor,
  value: unknown,
): BoardDescriptor {
  if (scope.kind === "board")
    return restoreAssets(base, validateAssistBoard(value));
  if (!object(value) || !object(value.runtime) || !Array.isArray(value.services))
    throw new Error(
      "Propose the runtime descriptor as `runtime` and its service list as `services`.",
    );
  if (value.runtime.id !== scope.runtimeId)
    throw new Error(
      `Only runtime '${scope.runtimeId}' may change; keep its id.`,
    );
  return validateAssistBoard({
    ...base,
    runtimes: base.runtimes.map((rt) =>
      rt.id === scope.runtimeId ? value.runtime : rt,
    ),
    services: { ...base.services, [scope.runtimeId]: value.services },
  });
}
