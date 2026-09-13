/**
 * Keeping a configured service as a preset.
 *
 * The one half of presets that has to happen in a board: what is worth keeping
 * is the thing someone has working in front of them. What it produces is an
 * ordinary preset file — kept on this device, which puts it in the Presets
 * source and in the menu of every service of that kind, and exportable from
 * there to reach anyone else.
 */

import { useState } from "react";
import { toast } from "sonner";

import CustomDialog from "../CustomDialog";
import { Button } from "../primitives/button";
import { Input } from "../primitives/input";
import { ServiceDescriptor } from "hkp-frontend/src/types";
import { useBoardContext } from "hkp-frontend/src/BoardContext";
import {
  normalizeTags,
  presetFromService,
  savePreset,
} from "hkp-frontend/src/core/presets";

export default function SavePresetDialog({
  service,
  isOpen,
  onOpenChange,
}: {
  service: ServiceDescriptor;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const boardContext = useBoardContext();
  const [name, setName] = useState(service.serviceName ?? "");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const runtime = Object.entries(boardContext?.services ?? {})
    .filter(([, list]) => list.some((svc) => svc.uuid === service.uuid))
    .map(([runtimeId]) =>
      boardContext?.runtimes.find((rt) => rt.id === runtimeId),
    )[0];

  const save = async () => {
    if (!boardContext || !runtime || !name.trim()) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const state = await boardContext.readServiceState(runtime, {
        uuid: service.uuid,
      });
      const preset = presetFromService(service, state, name.trim(), {
        tags: normalizeTags(tags.split(",")),
      });
      savePreset(preset);
      onOpenChange(false);
      toast.success(
        `Saved “${preset.name}”. It is in the Presets source on the start page.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CustomDialog
      title="Save as a preset"
      description={`The configuration of “${service.serviceName}” becomes a preset for every ${service.serviceId}.`}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="sm:max-w-[460px] h-auto"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <Input
            autoFocus
            value={name}
            placeholder="Name it — “Weather API, metric”"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void save();
              }
            }}
            style={{ fontSize: 16, height: 32 }}
          />
          <Button
            className="hkp-svc-btn"
            variant="outline"
            disabled={busy || !name.trim() || !runtime}
            onClick={() => void save()}
          >
            Save
          </Button>
        </div>
        <Input
          value={tags}
          placeholder="Tags — messaging, audio (comma separated)"
          onChange={(e) => setTags(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void save();
            }
          }}
          style={{ fontSize: 16, height: 32 }}
        />
        <div style={{ fontSize: 12, color: "var(--text-mid)" }}>
          Tags are where it is filed under {service.serviceId} on the start
          page — worth giving one to a sub-service, where the service alone says
          nothing about what the preset does. Secret references travel with it;
          the values never do.
        </div>
        {error && (
          <div style={{ fontSize: 12, color: "var(--hkp-error, #dc2626)" }}>
            {error}
          </div>
        )}
      </div>
    </CustomDialog>
  );
}
