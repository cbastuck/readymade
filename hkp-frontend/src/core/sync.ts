import {
  isBlob,
  isFunction,
  isSomeObject,
} from "../runtime/browser/services/helpers";

function reconstructData(incoming: Record<string, any>): Record<string, any> {
  return Object.keys(incoming).reduce<Record<string, any>>((all, key) => {
    const value = incoming[key];
    if (isSomeObject(value)) {
      return value.__typeTag === "blob"
        ? {
            ...all,
            [key]: new Blob([value.value], { type: value.__mimetype }),
          }
        : { ...all, [key]: reconstructData(value) };
    }
    return { ...all, [key]: value };
  }, {});
}

export function mergeBoardState(
  _oldBoardState: any,
  updatedBoardState: any,
  defaultBrowserRegistry: any
): any {
  const { services, runtimes } = updatedBoardState;
  const updatedState = {
    services: Object.keys(services).reduce<Record<string, any[]>>(
      (acc, runtimeId) => ({
        ...acc,
        [runtimeId]: services[runtimeId].map((svc: any) => reconstructData(svc)),
      }),
      {}
    ),
    runtimes,
    registry: runtimes.reduce(
      (all: Record<string, any>, rt: any) => ({
        ...all,
        [rt.id]: defaultBrowserRegistry.availableServices,
      }),
      {}
    ),
  };
  return Object.keys(updatedState).length > 0 ? updatedState : undefined;
}

function prepareData(obj: Record<string, any>): Record<string, any> {
  return Object.keys(obj).reduce<Record<string, any>>((all, key) => {
    const value = obj[key];
    if (isFunction(value)) {
      return all;
    } else if (isSomeObject(value) && !isBlob(value)) {
      return { ...all, [key]: prepareData(value) };
    } else if (isBlob(value)) {
      return {
        ...all,
        [key]: {
          __typeTag: "blob",
          __mimetype: (value as Blob).type,
          value,
        },
      };
    }
    return { ...all, [key]: value };
  }, {});
}

export function extractSyncState(data: any): any {
  return {
    runtimes: data.runtimes.map((rt: any) => ({
      id: rt.id,
      name: rt.name,
      type: rt.type,
    })),
    services: Object.keys(data.services).reduce<Record<string, any[]>>(
      (all, runtimeId) => ({
        ...all,
        [runtimeId]: data.services[runtimeId].map((svc: any) => prepareData(svc)),
      }),
      {}
    ),
  };
}
