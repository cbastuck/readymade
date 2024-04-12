import { filterPrivateMembers } from "@/runtime/browser/services/helpers";
import { ServiceDescriptor } from "@/types";

type Props = {
  draggable?: boolean;
  service: ServiceDescriptor;
  onDoubleClick: () => void;
};
export default function ServiceName({
  draggable = true,
  service,
  onDoubleClick,
}: Props) {
  return (
    <div
      style={{
        textAlign: "center",
        width: "100%",
        marginTop: 15,
        cursor: draggable ? "pointer" : undefined,
      }}
      onDoubleClick={onDoubleClick}
      draggable={draggable}
      onDragStart={(ev) => {
        const publicService = filterPrivateMembers(service);
        ev.dataTransfer.setData("text/plain", JSON.stringify(publicService));
      }}
    >
      <span
        className="font-sans text-sm"
        style={{
          whiteSpace: "nowrap",
        }}
        title={service.uuid}
      >
        {service.serviceName}
      </span>
    </div>
  );
}
