import { createContext, useContext } from "react";
import { vaultGet, vaultSet } from "./vault";

type VaultContextValue = {
  getSecret: (key: string) => string | null;
  setSecret: (key: string, secret: string) => void; // not persisted
};

const VaultContext = createContext<VaultContextValue>({
  getSecret: vaultGet,
  setSecret: vaultSet,
});

export function useVault() {
  return useContext(VaultContext);
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
