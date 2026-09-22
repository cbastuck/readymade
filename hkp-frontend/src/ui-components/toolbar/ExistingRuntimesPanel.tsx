import { useState } from "react";
import { Pencil } from "lucide-react";

import { RuntimeClass } from "hkp-frontend/src/types";
import EditServerForm from "../connections/EditServerForm";
import { toServerBaseUrl } from "../connections/serverUrl";
import { ColorPicker } from "../ColorPicker";
import {
  RemoveButton,
  SettingsList,
  SettingsRow,
  SettingsSection,
} from "../settings/kit";

type Props = {
  remoteRuntimes: Array<RuntimeClass>;
  onRemoveRuntime: (rt: RuntimeClass) => void;
  onChangeRuntimeColor: (rt: RuntimeClass, color: string) => void;
  /** Replaces `previous` with `next`. Offers an edit on each row when set. */
  onUpdateRuntime?: (previous: RuntimeClass, next: RuntimeClass) => void;
};

export default function ExistingRuntimesPanel({
  remoteRuntimes,
  onRemoveRuntime,
  onChangeRuntimeColor,
  onUpdateRuntime,
}: Props) {
  // The row being edited, by index: two entries may share a name or a URL.
  const [editing, setEditing] = useState<number | null>(null);

  return (
    <SettingsSection label="Runtime servers">
      <SettingsList empty="No remote runtimes registered yet.">
        {remoteRuntimes.map((rt, idx) => {
          const builtIn = rt.url?.startsWith("hkp://remotes/") ?? false;
          // Built-in remotes are the host's own: it decides what they are
          // called and where they live, so neither end is editable.
          const editable = !!onUpdateRuntime && !builtIn;
          return (
            <SettingsRow
              key={`${rt.name}-${rt.url}-${idx}`}
              bareIcon
              icon={
                <ColorPicker
                  showPaletteOnly={true}
                  disabled={builtIn}
                  onChange={(color) => onChangeRuntimeColor(rt, color)}
                  value={rt.color || "white"}
                  className="h-7 w-7 shrink-0"
                />
              }
              title={rt.name}
              subtitle={rt.url}
              trailing={
                !builtIn && (
                  <>
                    {editable && editing !== idx && (
                      <button
                        className="hkp-set-icon-btn hkp-set-icon-btn--neutral"
                        onClick={() => setEditing(idx)}
                        aria-label={`Edit ${rt.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    <RemoveButton
                      label={`Remove ${rt.name}`}
                      onClick={() => {
                        setEditing(null);
                        onRemoveRuntime(rt);
                      }}
                    />
                  </>
                )
              }
            >
              {editable && editing === idx && (
                <EditServerForm
                  name={rt.name}
                  url={rt.url ?? ""}
                  normalizeUrl={toServerBaseUrl}
                  onCancel={() => setEditing(null)}
                  onSave={({ name, url }) => {
                    onUpdateRuntime!(rt, { ...rt, name, url });
                    setEditing(null);
                  }}
                />
              )}
            </SettingsRow>
          );
        })}
      </SettingsList>
    </SettingsSection>
  );
}
