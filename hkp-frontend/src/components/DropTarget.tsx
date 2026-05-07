import { useTheme } from "hkp-frontend/src/ui-components/ThemeContext";
import { CSSProperties, DragEvent, useState } from "react";

type Props = {
  className?: string;
  style?: CSSProperties;
  children?: JSX.Element;
  acceptedType: string;
  disabled?: boolean;
  activeColor?: string;
  onDrop: (data: any) => void;
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
  const onDragOver = (ev: DragEvent) => {
    if (ev.dataTransfer.types.includes(acceptedType) && !disabled) {
      setIsActive(true);
      ev.preventDefault();
    }
  };

  const onDragLeave = (_ev: DragEvent) => {
    setIsActive(false);
  };

  const onDrop = (ev: DragEvent) => {
    if (!disabled && ev.dataTransfer.types.includes(acceptedType)) {
      setIsActive(false);
      onDropProp(ev.dataTransfer.getData(acceptedType));
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
