/**
 * Wrapping a run of a runtime's services in a sub-service on the running
 * board, and making a block of it in the same step. What decides whether a
 * run can be wrapped is in `runtime/board/wrap`; this is where it is done.
 */

import {
  isRuntimeBrowserClassType,
  isRuntimeRestClassType,
  RuntimeServiceMap,
  ServiceClass,
  ServiceDescriptor,
  toCanonicalServiceId,
} from "../types";
import { FacadeDescriptor } from "../facade/types";
import { withServicesWrapped } from "../runtime/board/blocks";
import { BoardLinkage } from "../runtime/board/units";
import {
  contiguousRun,
  nameForRun,
  rewriteFacadeAddresses,
  wrapProblems,
} from "../runtime/board/wrap";
import { BoardStateRefs, getRuntimeScopeApi } from "./boardContextTypes";
import { serializeBoard } from "./boardPersistence";
import { addService, removeService } from "./serviceOperations";
import { blockFrom } from "./blockActions";
import { BlockDefinition } from "./presets";

export type WrapOptions = {
  /** The sub-service's name; by default made from the names of what it wraps. */
  name?: string;
  /** Make the sub-service a block of this board, and it the block's first use. */
  asBlock?: boolean;
};

export type Wrapped = {
  /** The uuid of the sub-service that now holds the run. */
  wrapper: string;
  /** The block made of it, when one was asked for. */
  block?: BlockDefinition;
};

/** Refused, with each reason a person can act on. */
export class WrapRefused extends Error {
  constructor(readonly reasons: string[]) {
    super(reasons.join("\n"));
    this.name = "WrapRefused";
  }
}

/**
 * Replaces the run `uuids` of runtime `runtimeId` with one sub-service holding
 * it, where the run was. Each service is recreated inside under its own uuid,
 * as its `instanceId`, from the state it reports now — so what it was set to
 * carries over, and what it only held while running (a recording, a timer's
 * position) starts again.
 *
 * Refused before anything changes when the run is not contiguous, or when a
 * reference would be cut in two (see `wrapProblems`). The facade's addresses
 * into the run are rewritten to reach through the sub-service, and the uses of
 * blocks in the run are followed into it, so saving still writes them as uses.
 */
export async function wrapServices(
  runtimeId: string,
  uuids: string[],
  refs: BoardStateRefs,
  facade: () => FacadeDescriptor | undefined,
  latestLinkage: () => BoardLinkage | undefined,
  options: WrapOptions = {},
): Promise<Wrapped> {
  const runtime = refs.runtimesRef.current?.find((rt) => rt.id === runtimeId);
  if (!runtime) {
    throw new Error(`wrapServices: no runtime "${runtimeId}"`);
  }
  if (
    !isRuntimeBrowserClassType(runtime.type) &&
    !isRuntimeRestClassType(runtime.type)
  ) {
    throw new WrapRefused([
      `A ${runtime.type} runtime has no sub-service to wrap services in.`,
    ]);
  }
  const [scope, api] = getRuntimeScopeApi(runtimeId, refs);
  if (!scope || !api) {
    throw new Error(`wrapServices: runtime "${runtimeId}" is not running`);
  }
  const current = refs.servicesRef.current?.[runtimeId] ?? [];
  const order = current.map((svc) => svc.uuid);
  const run = contiguousRun(order, uuids);
  if (!run) {
    throw new WrapRefused([
      "Only services next to each other can be wrapped: their order is how they are wired.",
    ]);
  }
  const asBlock = !!options.asBlock;
  const linkage = latestLinkage();
  if (asBlock && linkage?.blocks?.editing) {
    throw new WrapRefused([
      "A block is being edited; apply or cancel that first.",
    ]);
  }

  const serialized = await serializeBoard(refs);
  if (!serialized) {
    throw new Error("wrapServices: the board could not be read");
  }
  const facades = [
    facade(),
    ...(linkage?.views ?? []).map((view) => view.facade),
  ].filter((entry) => !!entry);
  const problems = wrapProblems({
    services: serialized.services,
    facades,
    runtimeId,
    ids: run,
    asBlock,
  });
  if (problems.length) {
    throw new WrapRefused(problems);
  }

  const reported = new Map(
    (serialized.services[runtimeId] ?? []).map((entry: any) => [
      entry.uuid,
      entry,
    ]),
  );
  const moving = run.map((uuid) => current.find((svc) => svc.uuid === uuid)!);
  const pipeline = moving.map((svc) => {
    const entry = reported.get(svc.uuid);
    const serviceName = entry?.serviceName ?? svc.serviceName;
    return {
      serviceId: svc.serviceId,
      instanceId: svc.uuid,
      ...(serviceName ? { serviceName } : {}),
      ...(entry?.state ? { state: entry.state } : {}),
    };
  });
  const state: Record<string, unknown> = {
    // The runtime's slots, as the services had them before they were wrapped.
    scope: { slots: "inherit" },
    pipeline,
  };

  const subService: ServiceClass = refs.registryRef.current?.[runtimeId]?.find(
    (svc) => toCanonicalServiceId(svc.serviceId) === "sub-service",
  ) ?? {
    serviceId: "sub-service",
    serviceName: "SubService",
    capabilities: ["subservices"],
  };
  const name =
    options.name?.trim() ||
    nameForRun(pipeline.map((entry) => entry.serviceName ?? entry.serviceId));
  const created = await addService(
    { ...subService, serviceName: name },
    runtime,
    refs,
    undefined,
    order.indexOf(run[0]),
    state,
  );
  if (!created) {
    throw new Error("wrapServices: the sub-service could not be created");
  }
  for (const svc of moving) {
    await removeService(svc, runtime, refs);
  }

  const wrapper = created.uuid;
  refs.setFacade((prev) =>
    prev ? rewriteFacadeAddresses(prev, run, wrapper) : prev,
  );
  refs.setLinkage((prev) =>
    prev
      ? {
          ...prev,
          views: prev.views.map((view) => ({
            ...view,
            facade: rewriteFacadeAddresses(view.facade, run, wrapper),
          })),
          ...(prev.blocks
            ? {
                blocks: withServicesWrapped(
                  prev.blocks,
                  runtimeId,
                  run,
                  wrapper,
                ),
              }
            : {}),
        }
      : prev,
  );
  if (!asBlock) {
    return { wrapper };
  }

  // The board as it now stands, without waiting for it to render: the
  // services it had, with the run replaced by what the sub-service reports.
  const wrapperState = await Promise.resolve(
    api.getServiceConfig(scope, created),
  );
  const first = order.indexOf(run[0]);
  const services: RuntimeServiceMap = {
    ...serialized.services,
    [runtimeId]: [
      ...(serialized.services[runtimeId] ?? []).slice(0, first),
      {
        uuid: wrapper,
        serviceId: created.serviceId,
        serviceName: name,
        state: wrapperState ?? state,
      } as ServiceDescriptor,
      ...(serialized.services[runtimeId] ?? []).slice(first + run.length),
    ],
  };
  const made = blockFrom(
    services,
    latestLinkage()?.blocks,
    wrapper,
    runtimeId,
    refs.runtimesRef.current ?? [],
  );
  refs.setLinkage((prev) => ({
    units: prev?.units ?? [],
    views: prev?.views ?? [],
    ...prev,
    blocks: made.linkage,
  }));
  return { wrapper, block: made.definition };
}
