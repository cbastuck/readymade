import { ReactNode } from "react";
import {
  PlatformCapabilities,
  PlatformProvider,
} from "hkp-frontend/src/platform/PlatformContext";
import { getBackend } from "../backend";

// Capabilities are only wired up when the native saucer APIs are actually present
// (i.e. running inside the Meander desktop webview, not in a plain browser).
// When absent the provider still wraps the tree but with an empty capabilities
// object, so hkp-frontend components fall back to their browser defaults.
const saucer = (window as any).saucer;
const isNative = !!(
  saucer?.exposed?.pickSavePath && saucer?.exposed?.writeFile
);

const capabilities: PlatformCapabilities = isNative
  ? {
      saveRuntimeToDisk: async (json, _filename) => {
        const backend = await getBackend();
        const path = await backend.pickSavePath({ filters: ["*.json"] });
        if (path) {
          await backend.writeFile(path, json);
        }
      },
    }
  : {};

export function MeanderPlatformProvider({ children }: { children: ReactNode }) {
  return <PlatformProvider value={capabilities}>{children}</PlatformProvider>;
}
