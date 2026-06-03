import { ServiceDescriptor } from "hkp-frontend/src/types";
import Editable from "../Editable";

import { useThemeControl } from "hkp-frontend/src/ui-components/ThemeContext";

type Props = {
  draggable?: boolean;
  service: ServiceDescriptor;
  onRename: (newName: string) => void;
};
export default function ServiceName({ service, onRename }: Props) {
  const { themeName } = useThemeControl();
  const isPlayground = themeName === "playground";

  if (isPlayground) {
    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          fontWeight: 500,
          color: "var(--text, #1a1a1a)",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Editable value={service.serviceName} onChange={onRename} />
      </div>
    );
  }

  return (
    <div className="w-full flex mb-4 font-sans">
      <Editable value={service.serviceName} onChange={onRename} />
    </div>
  );
}
