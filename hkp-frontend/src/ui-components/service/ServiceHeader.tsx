import { CustomMenuEntry, ServiceDescriptor } from "@/types";

import BypassSwitch from "./BypassSwitch";
import ServiceSettings from "./ServiceSettings";
import ServiceName from "./ServiceName";
import { filterPrivateMembers } from "@/runtime/browser/services/helpers";
import DragSource from "@/components/DragSource";
import { HKP_DND_SERVICE_TYPE } from "@/components/DropTypes";

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
}: Props) {
  const onChangeName = (newName: string) => {
    console.log("TODO: Implement me CHANGE SERVICE NAME", newName);
  };
  const bypassDisabled = showBypassOnlyIfExplicit && bypass === undefined;
  const filteredSvc = filterPrivateMembers(service);
  const cursor = "move";

  return (
    <DragSource
      className="flex"
      style={{ cursor }}
      type={HKP_DND_SERVICE_TYPE}
      value={filteredSvc}
    >
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
    </DragSource>
  );
}
