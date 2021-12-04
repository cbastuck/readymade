export function syncBoard(
  prevBoardState,
  updatedBoardState,
  defaultBrowserRegistry
) {
  const { services, runtimes } = updatedBoardState.data;
  return {
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
}
