import { useCallback, useMemo, useState } from "react";

import {
  CoordinatorDescriptor,
  restoreCoordinators,
  storeCoordinators,
} from "../../common";
import { CoordinatorsController } from "./types";

const sameCoordinator = (a: CoordinatorDescriptor, b: CoordinatorDescriptor) =>
  a.name === b.name && a.url === b.url;

/**
 * A CoordinatorsController over the stored coordinators — the one list every
 * surface reads (the deploy menu, the Cloud Boards view, the playground's
 * engine picker), so a coordinator added through this controller is there for
 * all of them. Unlike remotes, no host keeps coordinators anywhere else.
 *
 * `onManage` is the caller's: it is the host that knows which of its surfaces
 * shows the manage UI.
 */
export function useLocalStorageCoordinators(
  onManage?: () => void,
): CoordinatorsController {
  const [coordinators, setCoordinators] =
    useState<CoordinatorDescriptor[]>(restoreCoordinators);

  const mutate = useCallback((next: CoordinatorDescriptor[]) => {
    storeCoordinators(next);
    setCoordinators(next);
  }, []);

  // The sources rebuild their folders whenever the controller changes, so it
  // only changes when the list or the action does.
  return useMemo(
    () => ({
      coordinators,
      onAdd: (coordinator: CoordinatorDescriptor) =>
        mutate([...coordinators, coordinator]),
      onRemove: (coordinator: CoordinatorDescriptor) =>
        mutate(coordinators.filter((c) => !sameCoordinator(c, coordinator))),
      onManage,
    }),
    [coordinators, mutate, onManage],
  );
}
