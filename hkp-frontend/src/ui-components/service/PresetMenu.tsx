/**
 * Presets in a service's menu: a list to pick from, and nothing else.
 *
 * The menu answers one question — which preset do I want on *this* service —
 * so it is a submenu of names rather than a panel. Everything that is
 * management (what exists, where it came from, what is inside one, importing
 * and deleting) belongs to the Presets source on the start page, where the
 * boards are organised too.
 *
 * The one action here that cannot live there is the reverse direction: a
 * service configured the way someone wants to keep it only exists in a board,
 * so that is where it becomes a preset.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "hkp-frontend/src/ui-components/primitives/dropdown-menu";
import MenuIcon from "../MenuIcon";
import { Bookmark, Save } from "lucide-react";
import { ServiceDescriptor } from "hkp-frontend/src/types";
import { useBoardContext } from "hkp-frontend/src/BoardContext";
import { Preset, subscribePresets } from "hkp-frontend/src/core/presets";
import { presetsForService } from "hkp-frontend/src/presetRegistry";
import { unavailableSecrets } from "hkp-frontend/src/core/secrets";

/**
 * The presets for a service, kept current.
 *
 * They are stored on the device, and a preset imported on the start page has
 * to appear here without a reload — the store says when it changes.
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

export default function PresetMenu({
  service,
  onSave,
}: {
  service: ServiceDescriptor;
  onSave: () => void;
}) {
  const boardContext = useBoardContext();
  const presets = usePresetsForService(service.serviceId);

  const runtime = Object.entries(boardContext?.services ?? {})
    .filter(([, list]) => list.some((svc) => svc.uuid === service.uuid))
    .map(([runtimeId]) =>
      boardContext?.runtimes.find((rt) => rt.id === runtimeId),
    )[0];

  const apply = async (preset: Preset) => {
    if (!boardContext || !runtime) {
      return;
    }
    try {
      await boardContext.applyPreset(preset, runtime, { uuid: service.uuid });
      const missing = unavailableSecrets(preset.state);
      if (missing.length) {
        // Applied all the same: the preset is right, the key is simply not on
        // this device, and naming it is more use than refusing to configure.
        toast.warning(
          `Applied “${preset.name}”. No secret named ${missing
            .map((alias) => `“${alias}”`)
            .join(", ")} on this device.`,
        );
      } else {
        toast.success(`Applied “${preset.name}”`);
      }
    } catch (err) {
      toast.error(
        `Could not apply “${preset.name}”: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="text-base">
        <MenuIcon icon={Bookmark} />
        <span>Presets</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-64 font-menu">
        {presets.length === 0 ? (
          <DropdownMenuItem disabled className="text-base">
            <span>No presets for {service.serviceId}</span>
          </DropdownMenuItem>
        ) : (
          presets.map((preset) => (
            <DropdownMenuItem
              key={`${preset.serviceId}:${preset.id}`}
              className="text-base"
              disabled={!runtime}
              onClick={() => void apply(preset)}
            >
              <span>{preset.name}</span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-base"
          disabled={!runtime}
          onClick={onSave}
        >
          <MenuIcon icon={Save} />
          <span>Save configuration…</span>
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
