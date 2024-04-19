import { ServiceDescriptor } from "@/types";

import BypassSwitch from "./BypassSwitch";
import ServiceSettings from "./ServiceSettings";
import ServiceName from "./ServiceName";
import { CustomMenuEntry } from "./ServiceFrame";

type Props = {
  showBypassOnlyIfExplicit: boolean;
  bypass?: boolean;
  isCollapsed: boolean;
  service: ServiceDescriptor;
  customMenuEntries?: Array<CustomMenuEntry>;
  onDoubleClick: () => void;
  onExpand: (isExpanded: boolean) => void;
  onDelete: () => void;
  onBypass: (isBypass: boolean) => void;
  onHelp: () => void;
  onConfig: () => void;
  onCustomEntry: (item: CustomMenuEntry) => void;
};
export default function ServiceHeader({
  showBypassOnlyIfExplicit,
  bypass,
  service,
  isCollapsed,
  customMenuEntries,
  onBypass,
  onDoubleClick,
  onExpand,
  onDelete,
  onHelp,
  onConfig,
  onCustomEntry,
}: Props) {
  const onChangeName = (newName: string) => {
    console.log("TODO: Implement me CHANGE SERVICE NAME", newName);
  };
  const bypassDisabled = showBypassOnlyIfExplicit && bypass === undefined;
  return (
    <div className="flex">
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
      <ServiceName
        service={service}
        onDoubleClick={onDoubleClick}
        onRename={onChangeName}
      />
      <BypassSwitch
        bypass={!!bypass}
        onChange={onBypass}
        disabled={bypassDisabled}
      />
    </div>
  );
}
