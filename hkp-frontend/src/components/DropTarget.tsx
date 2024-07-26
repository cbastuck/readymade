import { useTheme } from "@/ui-components/ThemeContext";
import { useState } from "react";

type Props = {
  children: JSX.Element;
  acceptedType: string;
  disableDrag?: boolean;
};

export const HKP_DND_SERVICE_TYPE = "application/hkp-service";
export const HKP_DND_RUNTIME_TYPE = "application/hkp-runtime";

export default function DropTarget({
  children,
  acceptedType,
  disableDrag,
}: Props) {
  const [isActive, setIsActive] = useState(false);
  const theme = useTheme();
  return (
    <div
      style={{ background: isActive ? `${theme.accentColor}0A` : undefined }}
      onDragOver={(ev) => {
        if (ev.dataTransfer.types.includes(acceptedType) && !disableDrag) {
          console.log("DropTarget dragOver", acceptedType);
          setIsActive(true);
          ev.preventDefault();
        }
      }}
      onDragLeave={(_ev) => {
        setIsActive(false);
      }}
      onDrop={(ev) => {
        setIsActive(false);
        try {
          const data = JSON.parse(ev.dataTransfer.getData(acceptedType));
          if (data && data.serviceId) {
            console.log("DropTarget dropped", data);
          }
        } catch (err) {
          console.warn("Dropped unknown data");
        }
      }}
    >
      {children}
    </div>
  );
}
