import { createContext, useContext } from "react";

export interface PlatformCapabilities {
  saveRuntimeToDisk?: (json: string, filename: string) => Promise<void>;
}

const PlatformContext = createContext<PlatformCapabilities>({});

export const PlatformProvider = PlatformContext.Provider;

export function usePlatform(): PlatformCapabilities {
  return useContext(PlatformContext);
}
