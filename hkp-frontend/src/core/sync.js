import {
  isBlob,
  isFunction,
  isSomeObject,
} from "../runtime/browser/services/helpers";

function reconstructData(incoming) {
  return Object.keys(incoming).reduce((all, key) => {
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
  oldBoardState,
  updatedBoardState,
  defaultBrowserRegistry
) {
  const { services, runtimes } = updatedBoardState;
  const updatedState = {
    services: Object.keys(services).reduce(
      (acc, runtimeId) => ({
        ...acc,
        [runtimeId]: services[runtimeId].map((svc) => reconstructData(svc)),
      }),
      {}
    ),
    runtimes,
    registry: runtimes.reduce(
      (all, rt) => ({
        ...all,
        [rt.id]: defaultBrowserRegistry.availableServices,
      }),
      {}
    ),
  };
  return Object.keys(updatedState).length > 0 ? updatedState : undefined;
}

function prepareData(obj) {
  return Object.keys(obj).reduce((all, key) => {
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
          __mimetype: value.type,
          value,
        },
      };
    }
    return { ...all, [key]: value };
  }, {});
}

export function extractSyncState(data) {
  return {
    inputRouting: data.inputRouting,
    outputRouting: data.outputRouting,
    sidechainRouting: data.sidechainRouting,
    runtimes: data.runtimes.map((rt) => ({
      id: rt.id,
      name: rt.name,
      type: rt.type,
    })),
    services: Object.keys(data.services).reduce(
      (all, runtimeId) => ({
        ...all,
        [runtimeId]: data.services[runtimeId].map((svc) => prepareData(svc)),
      }),
      {}
    ),
  };
}
