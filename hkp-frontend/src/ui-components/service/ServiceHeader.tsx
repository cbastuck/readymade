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
  helpUrl: string;
  onConfig: () => void;
  onCustomEntry: (item: CustomMenuEntry) => void;
  onChangeName: (newName: string) => void;
  /** Keeps everything that writes out of reach; what only reads stays. */
  readOnly?: boolean;
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
  helpUrl,
  onConfig,
  onCustomEntry,
  onChangeName,
  readOnly = false,
}: Props) {
  const { themeName } = useThemeControl();
  const isPlayground = themeName === "playground";
  const bypassDisabled = showBypassOnlyIfExplicit && bypass === undefined;
  const bypassSwitch = (
    <BypassSwitch
      bypass={!!bypass}
      onChange={onBypass}
      disabled={bypassDisabled}
    />
  );
  // Still showing whether the service is bypassed, just out of reach.
  const bypassControl = readOnly ? (
    <span inert style={{ display: "flex" }}>
      {bypassSwitch}
    </span>
  ) : (
    bypassSwitch
  );

  if (isPlayground) {
    return (
      <div
        data-service-header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--hkp-svc-header-gap, 7px)",
          padding:
            "var(--hkp-svc-header-pad-y, 10px) var(--hkp-svc-header-pad-x, 12px)",
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
          helpUrl={helpUrl}
          onConfig={onConfig}
          onCustomEntry={onCustomEntry}
          readOnly={readOnly}
        />

        {/* Service name — flex: 1 */}
        <ServiceName
          service={service}
          readOnly={readOnly}
          onRename={onChangeName}
        />

        {/* Power / bypass button */}
        {!bypassDisabled && bypassControl}
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
        helpUrl={helpUrl}
        onConfig={onConfig}
        onCustomEntry={onCustomEntry}
        readOnly={readOnly}
      />
      <ServiceName
        service={service}
        readOnly={readOnly}
        onRename={onChangeName}
      />
      {bypassControl}
    </div>
  );
}
