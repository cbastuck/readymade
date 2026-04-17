import { v4 as uuidv4 } from "uuid";

import {
  BoardDescriptor,
  RuntimeDescriptor,
  RuntimeServiceMap,
  ServiceDescriptor,
  isBoardDescriptor,
} from "../../types";
import {
  FacadeDescriptor,
  FacadePanel,
  FacadeWidget,
  LayoutItem,
  LayoutContainer,
  LayoutWidget,
} from "../../facade/types";
import { decodeBoardState } from "./BoardLink";

function isContainer(item: LayoutItem): item is LayoutContainer | LayoutWidget {
  return "items" in item;
}

export function remapFacadeUuids(
  facade: FacadeDescriptor,
  uuidMap: Map<string, string>,
): FacadeDescriptor {
  const remap = (uuid: string) => uuidMap.get(uuid) ?? uuid;

  const remapWidget = (widget: FacadeWidget): FacadeWidget => {
    switch (widget.type) {
      case "message-list":
        return {
          ...widget,
          source: { ...widget.source, serviceUuid: remap(widget.source.serviceUuid) },
          composer: widget.composer
            ? {
                ...widget.composer,
                action: {
                  ...widget.composer.action,
                  serviceUuid: remap(widget.composer.action.serviceUuid),
                },
              }
            : undefined,
        };
      case "text-input":
        return {
          ...widget,
          action: { ...widget.action, serviceUuid: remap(widget.action.serviceUuid) },
        };
      case "status-indicator":
        return {
          ...widget,
          source: { ...widget.source, serviceUuid: remap(widget.source.serviceUuid) },
        };
      case "button":
        return {
          ...widget,
          action: { ...widget.action, serviceUuid: remap(widget.action.serviceUuid) },
        };
      case "knob":
        return {
          ...widget,
          action: { ...widget.action, serviceUuid: remap(widget.action.serviceUuid) },
        };
      case "level-meter":
        return {
          ...widget,
          source: { ...widget.source, serviceUuid: remap(widget.source.serviceUuid) },
          thresholdKnobServiceUuid: widget.thresholdKnobServiceUuid
            ? remap(widget.thresholdKnobServiceUuid)
            : undefined,
        };
      case "qr-code":
        return {
          ...widget,
          source: { ...widget.source, serviceUuid: remap(widget.source.serviceUuid) },
        };
      case "file-pick":
        return {
          ...widget,
          action: { ...widget.action, serviceUuid: remap(widget.action.serviceUuid) },
          progressServiceUuid: widget.progressServiceUuid
            ? remap(widget.progressServiceUuid)
            : undefined,
        };
      default:
        return widget;
    }
  };

  const remapLayoutItem = (item: LayoutItem): LayoutItem => {
    if (isContainer(item)) {
      return { ...item, items: item.items.map(remapLayoutItem) };
    }
    return remapWidget(item);
  };

  const remapPanel = (panel: FacadePanel): FacadePanel => ({
    ...panel,
    layout: remapLayoutItem(panel.layout),
  });

  return { ...facade, panels: facade.panels.map(remapPanel) };
}

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
    const { runtimes, services, description, registry, facade } = template;

    const patchedRuntimes = runtimes.map((rt) => ({
      ...rt,
      id: uuidv4(),
    }));

    // Build a service UUID map (oldUuid → newUuid) so facade references can be remapped.
    const uuidMap = new Map<string, string>();
    const patchedServices = patchedRuntimes.reduce<RuntimeServiceMap>(
      (all, rt, idx) => {
        const originalRtId = runtimes[idx].id;
        const patchedSvcs = services[originalRtId].map((svc) => {
          const newUuid = uuidv4();
          uuidMap.set(svc.uuid, newUuid);
          return { ...svc, uuid: newUuid };
        });
        return { ...all, [rt.id]: patchedSvcs };
      },
      {},
    );

    return {
      runtimes: patchedRuntimes,
      services: patchedServices,
      description,
      registry,
      facade: facade ? remapFacadeUuids(facade, uuidMap) : undefined,
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
