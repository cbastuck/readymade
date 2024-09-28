import { ReactElement } from "react";

import Icon from "./Icon";

type Props = {
  style?: React.CSSProperties;
  className?: string;
  children?: ReactElement | undefined | string;
  icon?: React.ComponentType<any>;
  border?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export default function IconButton({
  style,
  className,
  children,
  icon,
  border,
  disabled,
  onClick,
}: Props) {
  return (
    <button
      style={style}
      className={`${className || ""} ${
        border ? "border rounded hover:border-black" : ""
      }`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon ? <Icon className="hover:stroke-black" value={icon} /> : children}
    </button>
  );
}
