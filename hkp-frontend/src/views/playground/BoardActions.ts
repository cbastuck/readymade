import { v4 as uuidv4 } from "uuid";

import { replacePlaceholders } from "../../core/url";
import {
  BoardDescriptor,
  PlaygroundBoard,
  PlaygroundTemplate,
  RuntimeDescriptor,
  RuntimeServiceMap,
  ServiceDescriptor,
  RuntimeOutputRoutings,
  isBoardDescriptor,
} from "../../types";
import { decodeBoardState } from "./BoardLink";
import { defaultDiscoveryPeer } from "./common";

export async function importBoard(
  url: string,
): Promise<BoardDescriptor | null> {
  const res = await fetch(url);
  const data: any = await res.json();
  if (isBoardDescriptor(data)) {
    return data;
  }

  const runtimeIds = Object.keys(data);
  const board = {
    runtimes: runtimeIds.map((rid, ridx) => ({
      id: rid,
      type: data[rid].type,
      name: data[rid].name || `Runtime ${ridx + 1}`,
      bundles: data[rid].bundles,
    })),
    services: runtimeIds.reduce(
      (all, rid) => ({
        ...all,
        [rid]: data[rid].services.map((svc: ServiceDescriptor) => {
          if (!svc.uuid) {
            return { ...svc, uuid: uuidv4() };
          }
          return svc;
        }),
      }),
      {},
    ),
    registry: data.registry || {},
  };

  return board;
}

export async function createBoardFromTemplate(
  templateUrl: string,
  params: any,
): Promise<PlaygroundBoard | null> {
  const resp = await fetch(templateUrl);
  if (!resp || !resp.ok) {
    return null;
  }
  try {
    const template: PlaygroundTemplate = await resp.json();
    const {
      runtimes,
      services,
      sidechainRouting,
      description,
      inputRouting,
      outputRouting,
      registry,
    } = template;
    const patchedRuntimes = runtimes.map((rt) => ({
      ...rt,
      id: uuidv4(),
    }));

    const patchedServices = patchedRuntimes.reduce<RuntimeServiceMap>(
      (all, rt, idx) => ({
        ...all,
        [rt.id]: services[runtimes[idx].id].map((svc) => ({
          ...svc,
          uuid: uuidv4(),
        })),
      }),
      {},
    );

    const partchedSidechainRouting = sidechainRouting
      ? patchedRuntimes.reduce((all, rt, idx) => {
          const originalRt = runtimes[idx];
          const originalRuntimeSidechain =
            sidechainRouting[originalRt.id] || [];
          const patchedRuntimeSidechain = originalRuntimeSidechain.map(
            (entry) => {
              const origRTIndex = runtimes.findIndex(
                (r) => r.id === entry.runtimeId,
              );
              if (origRTIndex === -1) {
                console.error(
                  "createBoardFromTemplate(): could not find runtime",
                  entry,
                  runtimes,
                );
              }
              const origSvcIndex = services[entry.runtimeId].findIndex(
                (svc) => svc.uuid === entry.serviceUuid,
              );
              if (origSvcIndex === -1) {
                console.error(
                  "createBoardFromTemplate(): could not find service",
                  entry,
                  services[originalRt.id],
                );
              }
              const patchedRuntimeId = patchedRuntimes[origRTIndex].id;
              return {
                runtimeId: patchedRuntimeId,
                serviceUuid:
                  patchedServices[patchedRuntimeId][origSvcIndex].uuid,
              };
            },
          );
          return {
            ...all,
            [rt.id]: patchedRuntimeSidechain,
          };
        }, {})
      : {};

    const patchedInputRouting = inputRouting
      ? patchedRuntimes.reduce((all, rt, idx) => {
          const currentRuntimeInputRouting: string =
            inputRouting[runtimes[idx].id]; // NOTE: inputRouting is of tyoe DeprecatedInputRouting in this case, when reading from a template
          const inputHost = currentRuntimeInputRouting
            ? defaultDiscoveryPeer
            : null;
          const peerInput =
            replacePlaceholders(currentRuntimeInputRouting, params) || null;
          return {
            ...all,
            [rt.id]: {
              hostDescriptor: inputHost,
              route: {
                peer: peerInput,
              },
            },
          };
        }, {})
      : {};

    const patchedOutputRouting = outputRouting
      ? patchedRuntimes.reduce<RuntimeOutputRoutings>((all, rt, idx) => {
          const routing = outputRouting[runtimes[idx].id];
          return routing
            ? {
                ...all,
                [rt.id]: {
                  hostDescriptor: null,
                  route: {
                    ...routing,
                    peer: routing.peer
                      ? replacePlaceholders(routing.peer, params) || null
                      : null,
                  },
                  flow: "pass",
                },
              }
            : all;
        }, {})
      : {};

    return {
      runtimes: patchedRuntimes,
      services: patchedServices,
      sidechainRouting: partchedSidechainRouting,
      inputRouting: patchedInputRouting,
      outputRouting: patchedOutputRouting,
      description,
      registry,
    };
  } catch (err) {
    console.error("Creating from template failed", templateUrl, err);
    return null;
  }
}

export function reorderService(
  allServices: RuntimeServiceMap,
  runtime: RuntimeDescriptor,
  serviceUuid: string,
  targetPosition: number,
) {
  const services = allServices[runtime.id];
  const fromIndex = services.findIndex((svc) => serviceUuid === svc.uuid);
  const toIndex =
    targetPosition > fromIndex
      ? Math.max(targetPosition - 1, 0)
      : targetPosition;

  const newArr = [...services];
  newArr.splice(fromIndex, 1);
  newArr.splice(toIndex, 0, services[fromIndex]);
  return newArr;
}

export function reorderRuntime(
  runtimes: Array<RuntimeDescriptor>,
  runtimeId: string,
  targetPosition: number,
) {
  const fromIndex = runtimes.findIndex((rt) => runtimeId === rt.id);
  const toIndex =
    targetPosition > fromIndex
      ? Math.max(targetPosition - 1, 0)
      : targetPosition;

  const newArr = [...runtimes];
  newArr.splice(fromIndex, 1);
  newArr.splice(toIndex, 0, runtimes[fromIndex]);
  return newArr;
}

export function importFromLink(fromLink: string) {
  const src: string = decodeBoardState(fromLink);
  // Replace MEANDER_HOST with the actual hostname the browser connected to.
  // This lets board JSON use MEANDER_HOST as a stable placeholder instead of
  // hardcoding an IP that changes with each DHCP lease.
  const host = typeof window !== "undefined" ? window.location.hostname : "";

  console.log("HOSTNAME", host);
  const resolved = host ? src.replace(/MEANDER_HOST/g, host) : src;
  return JSON.parse(resolved);
}
