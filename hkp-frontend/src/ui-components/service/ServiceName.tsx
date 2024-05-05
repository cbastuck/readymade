import { DragEvent } from "react";

import { filterPrivateMembers } from "@/runtime/browser/services/helpers";
import { ServiceDescriptor } from "@/types";
import Editable from "../Editable";

type Props = {
  draggable?: boolean;
  service: ServiceDescriptor;
  onDoubleClick: () => void;
  onRename: (newName: string) => void;
};
export default function ServiceName({
  draggable = true,
  service,
  onDoubleClick,
  onRename,
}: Props) {
  const onStartDrag = (ev: DragEvent) => {
    const publicService = filterPrivateMembers(service);
    ev.dataTransfer.setData("text/plain", JSON.stringify(publicService));
  };
  const cursor = draggable ? "move" : undefined;
  return (
    <div
      className="w-full flex"
      style={{ cursor }}
      onDoubleClick={onDoubleClick}
      draggable={draggable}
      onDragStart={onStartDrag}
    >
      <div className="flex items-center pt-2 font-sans">
        <Editable
          value={service.serviceName}
          title={service.uuid}
          onChange={onRename}
        />
      </div>
    </div>
  );
}
