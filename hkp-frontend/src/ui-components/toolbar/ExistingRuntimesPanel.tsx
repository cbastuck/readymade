import { RuntimeClass } from "hkp-frontend/src/types";
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
};

export default function ExistingRuntimesPanel({
  remoteRuntimes,
  onRemoveRuntime,
  onChangeRuntimeColor,
}: Props) {
  return (
    <SettingsSection label="Runtime servers">
      <SettingsList empty="No remote runtimes registered yet.">
        {remoteRuntimes.map((rt, idx) => {
          const builtIn = rt.url?.startsWith("hkp://remotes/") ?? false;
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
                  <RemoveButton
                    label={`Remove ${rt.name}`}
                    onClick={() => onRemoveRuntime(rt)}
                  />
                )
              }
            />
          );
        })}
      </SettingsList>
    </SettingsSection>
  );
}
