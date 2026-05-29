import { CSSProperties } from "react";
import DropTarget from "hkp-frontend/src/components/DropTarget";
import {
  HKP_DND_SERVICE_TYPE,
  HKP_DND_SERVICE_CLASS_TYPE,
  isServiceInstanceDrop,
} from "hkp-frontend/src/components/DropTypes";
import { useTheme } from "hkp-frontend/src/ui-components/ThemeContext";
import { ServiceClass } from "hkp-frontend/src/types";

type Props = {
  index: number;
  /** Show a left drop zone for the very first card (drop at position 0). */
  isFirst?: boolean;
  isDragging?: boolean;
  children: JSX.Element;
  onDrop: (svcUuid: string, pos: number) => void;
  onDropServiceClass?: (serviceClass: ServiceClass, pos: number) => void;
};

export default function ServiceWithDropBars({
  onDrop: onDropProp,
  onDropServiceClass,
  index,
  isFirst = false,
  isDragging = false,
  children,
}: Props) {
  const theme = useTheme();

  const acceptedTypes = onDropServiceClass
    ? [HKP_DND_SERVICE_TYPE, HKP_DND_SERVICE_CLASS_TYPE]
    : HKP_DND_SERVICE_TYPE;

  const handleDrop = (idx: number, data: any, type: string) => {
    const dropData = JSON.parse(data);
    if (type === HKP_DND_SERVICE_CLASS_TYPE) {
      onDropServiceClass?.(dropData as ServiceClass, idx);
    } else if (isServiceInstanceDrop(dropData)) {
      onDropProp(dropData.uuid, idx);
    }
  };

  // Expand zones when a drag is in flight so they're easy to target.
  const zoneWidth = isDragging ? 18 : 8;
  const zoneOffset = zoneWidth / 2;

  const activeColor = `linear-gradient(to right, #ffffff00 20%, ${theme.dropBarColor} 50%, #ffffff00 80%)`;

  const zoneStyle = (side: "left" | "right"): CSSProperties => ({
    position: "absolute",
    [side]: side === "right" ? zoneOffset : -zoneOffset,
    top: 0,
    width: zoneWidth,
    height: "100%",
    zIndex: 20,
  });

  return (
    <div style={{ position: "relative" }}>
      {isFirst && (
        <div style={zoneStyle("left")}>
          <DropTarget
            style={{ width: "100%", height: "100%" }}
            activeColor={activeColor}
            acceptedType={acceptedTypes}
            onDrop={(data, type) => handleDrop(0, data, type)}
          />
        </div>
      )}

      {children}

      {/* Right zone covers position index+1 for every card. Earlier cards have
          higher z-index in the runtime, so this zone renders above the next card. */}
      <div style={zoneStyle("right")}>
        <DropTarget
          style={{ width: "100%", height: "100%" }}
          activeColor={activeColor}
          acceptedType={acceptedTypes}
          onDrop={(data, type) => handleDrop(index + 1, data, type)}
        />
      </div>
    </div>
  );
}
