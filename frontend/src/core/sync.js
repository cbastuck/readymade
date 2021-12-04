export function syncBoard(
  boardContext,
  updatedBoardState,
  defaultBrowserRegistry
) {
  const { services, runtimes } = updatedBoardState.data;
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
