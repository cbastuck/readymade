import { CustomMenuEntry, ServiceDescriptor } from "hkp-frontend/src/types";
import { useThemeControl } from "hkp-frontend/src/ui-components/ThemeContext";

import BypassSwitch from "./BypassSwitch";
import ServiceSettings from "./ServiceSettings";
import ServiceName from "./ServiceName";

type Props = {
  showBypassOnlyIfExplicit: boolean;
  bypass?: boolean;
  isCollapsed: boolean;
  service: ServiceDescriptor;
  customMenuEntries?: Array<CustomMenuEntry>;

  onExpand: (isExpanded: boolean) => void;
  onDelete: () => void;
  onBypass: (isBypass: boolean) => void;
  onHelp: () => void;
  onConfig: () => void;
  onCustomEntry: (item: CustomMenuEntry) => void;
  onChangeName: (newName: string) => void;
};

export default function ServiceHeader({
  showBypassOnlyIfExplicit,
  bypass,
  service,
  isCollapsed,
  customMenuEntries,
  onBypass,
  onExpand,
  onDelete,
  onHelp,
  onConfig,
  onCustomEntry,
  onChangeName,
}: Props) {
  const { themeName } = useThemeControl();
  const isPlayground = themeName === "playground";
  const bypassDisabled = showBypassOnlyIfExplicit && bypass === undefined;

  if (isPlayground) {
    return (
      <div
        data-service-header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "10px 12px",
          borderBottom: "1px solid var(--border-mid, #d8d2ca)",
        }}
      >
        {/* Drag handle / settings trigger */}
        <ServiceSettings
          service={service}
          isCollapsed={isCollapsed}
          customMenuEntries={customMenuEntries}
          onExpand={onExpand}
          onDelete={onDelete}
          onHelp={onHelp}
          onConfig={onConfig}
          onCustomEntry={onCustomEntry}
        />

        {/* Service name — flex: 1 */}
        <ServiceName service={service} onRename={onChangeName} />

        {/* Power / bypass button */}
        {!bypassDisabled && (
          <BypassSwitch
            bypass={!!bypass}
            onChange={onBypass}
            disabled={bypassDisabled}
          />
        )}
      </div>
    );
  }

  return (
    <div data-service-header className="flex items-end">
      <ServiceSettings
        service={service}
        isCollapsed={isCollapsed}
        customMenuEntries={customMenuEntries}
        onExpand={onExpand}
        onDelete={onDelete}
        onHelp={onHelp}
        onConfig={onConfig}
        onCustomEntry={onCustomEntry}
      />
      <ServiceName service={service} onRename={onChangeName} />
      <BypassSwitch
        bypass={!!bypass}
        onChange={onBypass}
        disabled={bypassDisabled}
      />
    </div>
  );
}
