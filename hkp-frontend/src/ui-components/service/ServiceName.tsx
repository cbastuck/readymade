import { ServiceDescriptor } from "@/types";
import Editable from "../Editable";

type Props = {
  draggable?: boolean;
  service: ServiceDescriptor;
  onRename: (newName: string) => void;
};
export default function ServiceName({ service, onRename }: Props) {
  return (
    <div className="w-full flex mb-4 font-sans">
      <Editable
        value={service.serviceName}
        title={service.uuid}
        onChange={onRename}
      />
    </div>
  );
}
