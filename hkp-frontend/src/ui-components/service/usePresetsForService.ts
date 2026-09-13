import { useEffect, useState } from "react";

import { Preset, subscribePresets } from "hkp-frontend/src/core/presets";
import { presetsForService } from "hkp-frontend/src/presetRegistry";

/**
 * The presets for a service, kept current.
 *
 * They are stored on the device and read in two places that never meet — a
 * service's menu and the sidebar palette — so a preset imported on the start
 * page has to appear in both without a reload. The store says when it changes,
 * because `localStorage` reports nothing to the tab that wrote it.
 */
export function usePresetsForService(serviceId: string): Preset[] {
  const [presets, setPresets] = useState<Preset[]>(() =>
    presetsForService(serviceId),
  );
  useEffect(() => {
    setPresets(presetsForService(serviceId));
    return subscribePresets(() => setPresets(presetsForService(serviceId)));
  }, [serviceId]);
  return presets;
}
