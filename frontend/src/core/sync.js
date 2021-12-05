export function mergeBoardState(
  oldBoardState,
  updatedBoardState,
  defaultBrowserRegistry
) {
  const { services, runtimes } = updatedBoardState;
  const updatedState = {
    services,
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
    const valueType = typeof value;
    if (valueType === "function") {
      return all;
    } else if (valueType === "object") {
      return { ...all, [key]: prepareData(value) };
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
