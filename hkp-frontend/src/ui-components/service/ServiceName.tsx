import { MouseEvent } from "react";
import { Copy } from "lucide-react";

import { ServiceDescriptor } from "hkp-frontend/src/types";
import Editable from "../Editable";

import { CustomTooltipActions } from "../Tooltip";
import IconButton from "../IconButton";
import { usePushNotifications } from "hkp-frontend/src/Notifications";

type Props = {
  draggable?: boolean;
  service: ServiceDescriptor;
  onRename: (newName: string) => void;
};
export default function ServiceName({ service, onRename }: Props) {
  const pusher = usePushNotifications();
  const onCopyInstanceID = (ev: MouseEvent) => {
    navigator.clipboard.writeText(service.uuid);
    pusher(`${service.uuid} copied to clipboard`);
    ev.preventDefault();
    ev.stopPropagation();
  };
  const tooltip: CustomTooltipActions = {
    text: `ID: ${service.uuid}`,
    actions: (
      <IconButton
        className="m-2"
        icon={Copy}
        onClick={onCopyInstanceID}
        iconClassName="hover:stroke-sky-600"
      />
    ),
  };
  return (
    <div className="w-full flex mb-4 font-sans">
      <Editable
        value={service.serviceName}
        onChange={onRename}
        tooltip={tooltip}
      />
    </div>
  );
}
