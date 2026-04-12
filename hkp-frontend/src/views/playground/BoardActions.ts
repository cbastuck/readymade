import { v4 as uuidv4 } from "uuid";

import {
  BoardDescriptor,
  RuntimeDescriptor,
  RuntimeServiceMap,
  ServiceDescriptor,
  isBoardDescriptor,
} from "../../types";
import { decodeBoardState } from "./BoardLink";

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
  _params: any,
): Promise<BoardDescriptor | null> {
  const resp = await fetch(templateUrl);
  if (!resp || !resp.ok) {
    return null;
  }
  try {
    const template: BoardDescriptor = await resp.json();
    const { runtimes, services, description, registry } = template;

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

    return {
      runtimes: patchedRuntimes,
      services: patchedServices,
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

export function importFromLink(fromLink: string, vars?: string) {
  let src = decodeBoardState(fromLink);
  if (vars) {
    try {
      const varMap: Record<string, string> = JSON.parse(atob(vars));
      for (const [key, value] of Object.entries(varMap)) {
        src = src.split(key).join(value);
      }
    } catch (e) {
      console.warn("importFromLink: could not parse vars", e);
    }
  }
  return JSON.parse(src);
}
