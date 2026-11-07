import { act, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { COORDINATORS_CHANGED, restoreCoordinators } from "../../../../common";
import {
  MobileConnectionsProvider,
  useMobileConnections,
} from "../MobileConnections";

/**
 * The coordinators the mobile app knows, as the Hub edits them and the Cloud
 * tab reads them. Storing the list announces it, so a change is announced
 * once — which an announcement made inside a state updater is not, since
 * StrictMode runs updaters twice.
 */

function wrapper({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <MobileConnectionsProvider>{children}</MobileConnectionsProvider>
    </StrictMode>
  );
}

const COORDINATOR = { name: "Home", url: "https://home.example.com" };

describe("mobile connections", () => {
  let announced: number;
  const count = () => {
    announced += 1;
  };

  beforeEach(() => {
    localStorage.clear();
    announced = 0;
    window.addEventListener(COORDINATORS_CHANGED, count);
  });

  afterEach(() => window.removeEventListener(COORDINATORS_CHANGED, count));

  it("adds a coordinator once, and announces it once", () => {
    const { result } = renderHook(() => useMobileConnections(), { wrapper });

    act(() => result.current.addCoordinator(COORDINATOR));
    act(() => result.current.addCoordinator(COORDINATOR));

    expect(result.current.coordinators).toEqual([COORDINATOR]);
    expect(restoreCoordinators()).toEqual([COORDINATOR]);
    expect(announced).toBe(1);
  });

  it("removes a coordinator from the list and the store", () => {
    const { result } = renderHook(() => useMobileConnections(), { wrapper });
    act(() => result.current.addCoordinator(COORDINATOR));

    act(() => result.current.removeCoordinator(COORDINATOR));

    expect(result.current.coordinators).toEqual([]);
    expect(restoreCoordinators()).toEqual([]);
    expect(announced).toBe(2);
  });
});
