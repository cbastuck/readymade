import { createContext, useContext } from "react";

export type FacadeStateStore = {
  state: Record<string, unknown>;
  setState: (key: string, value: unknown) => void;
};

export const FacadeStateContext = createContext<FacadeStateStore>({
  state: {},
  setState: () => {},
});

export const useFacadeState = () => useContext(FacadeStateContext);
