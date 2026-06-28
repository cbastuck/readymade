import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  CoordinatorDescriptor,
  restoreCoordinators,
  storeCoordinators,
  restoreAvailableRuntimeEngines,
  storeAvailableRuntimeEngines,
} from "../../../common";
import { RuntimeClass } from "../../../types";

// Shared, persisted "connections" for the mobile app: coordinators (cloud) and
// external runtime engines (local board). Both the Hub tab (which manages them)
// and the Cloud tab (which consumes coordinators) live under this provider, so
// an edit on the Hub reflects live on the Cloud tab without a remount.
type MobileConnectionsValue = {
  coordinators: CoordinatorDescriptor[];
  addCoordinator: (c: CoordinatorDescriptor) => void;
  removeCoordinator: (c: CoordinatorDescriptor) => void;
  // Remote (non-browser) runtime engines registered for the local board.
  runtimeEngines: RuntimeClass[];
  addRuntimeEngine: (rt: RuntimeClass) => void;
  removeRuntimeEngine: (rt: RuntimeClass) => void;
};

const MobileConnectionsContext = createContext<MobileConnectionsValue | null>(
  null,
);

export function useMobileConnections(): MobileConnectionsValue {
  const ctx = useContext(MobileConnectionsContext);
  if (!ctx) {
    throw new Error(
      "useMobileConnections must be used within a MobileConnectionsProvider",
    );
  }
  return ctx;
}

export function MobileConnectionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [coordinators, setCoordinators] = useState<CoordinatorDescriptor[]>(() =>
    restoreCoordinators(),
  );
  const [runtimeEngines, setRuntimeEngines] = useState<RuntimeClass[]>(() =>
    restoreAvailableRuntimeEngines(),
  );

  const addCoordinator = useCallback((c: CoordinatorDescriptor) => {
    setCoordinators((prev) => {
      if (prev.some((x) => x.url === c.url)) {
        return prev;
      }
      const next = [...prev, c];
      storeCoordinators(next);
      return next;
    });
  }, []);

  const removeCoordinator = useCallback((c: CoordinatorDescriptor) => {
    setCoordinators((prev) => {
      const next = prev.filter((x) => x.url !== c.url);
      storeCoordinators(next);
      return next;
    });
  }, []);

  const addRuntimeEngine = useCallback((rt: RuntimeClass) => {
    setRuntimeEngines((prev) => {
      // Upsert by URL: re-adding an existing URL replaces the entry so a
      // corrected type/name/color takes effect, rather than silently being
      // dropped (which would leave a stale, wrong-typed engine behind).
      const existingIdx = prev.findIndex((x) => x.url === rt.url);
      const next =
        existingIdx >= 0
          ? prev.map((x, i) => (i === existingIdx ? rt : x))
          : [...prev, rt];
      storeAvailableRuntimeEngines(next);
      return next;
    });
  }, []);

  const removeRuntimeEngine = useCallback((rt: RuntimeClass) => {
    setRuntimeEngines((prev) => {
      const next = prev.filter((x) => x.url !== rt.url);
      storeAvailableRuntimeEngines(next);
      return next;
    });
  }, []);

  const value = useMemo<MobileConnectionsValue>(
    () => ({
      coordinators,
      addCoordinator,
      removeCoordinator,
      runtimeEngines,
      addRuntimeEngine,
      removeRuntimeEngine,
    }),
    [
      coordinators,
      addCoordinator,
      removeCoordinator,
      runtimeEngines,
      addRuntimeEngine,
      removeRuntimeEngine,
    ],
  );

  return (
    <MobileConnectionsContext.Provider value={value}>
      {children}
    </MobileConnectionsContext.Provider>
  );
}
