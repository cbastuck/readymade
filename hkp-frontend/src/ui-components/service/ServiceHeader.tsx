import { CustomMenuEntry, ServiceDescriptor } from "hkp-frontend/src/types";

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
  const bypassDisabled = showBypassOnlyIfExplicit && bypass === undefined;
  return (
    <div className="flex items-end">
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
