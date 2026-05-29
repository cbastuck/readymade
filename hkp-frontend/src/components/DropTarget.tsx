import { useTheme } from "hkp-frontend/src/ui-components/ThemeContext";
import { CSSProperties, DragEvent, useState } from "react";

type Props = {
  className?: string;
  style?: CSSProperties;
  children?: JSX.Element;
  acceptedType: string | string[];
  disabled?: boolean;
  activeColor?: string;
  onDrop: (data: any, type: string) => void;
};

export default function DropTarget({
  className,
  children,
  acceptedType,
  disabled,
  activeColor,
  style = {},
  onDrop: onDropProp,
}: Props) {
  const [isActive, setIsActive] = useState(false);
  const theme = useTheme();
  const types = Array.isArray(acceptedType) ? acceptedType : [acceptedType];

  const onDragOver = (ev: DragEvent) => {
    if (types.some((t) => ev.dataTransfer.types.includes(t)) && !disabled) {
      setIsActive(true);
      ev.preventDefault();
    }
  };

  const onDragLeave = (_ev: DragEvent) => {
    setIsActive(false);
  };

  const onDrop = (ev: DragEvent) => {
    const matchedType = types.find((t) => ev.dataTransfer.types.includes(t));
    if (!disabled && matchedType) {
      setIsActive(false);
      onDropProp(ev.dataTransfer.getData(matchedType), matchedType);
      ev.preventDefault();
      ev.stopPropagation();
    }
  };

  return (
    <div
      className={className}
      style={{
        background: isActive
          ? activeColor || `${theme.accentColor}0A`
          : undefined,
        ...style,
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
    </div>
  );
}
