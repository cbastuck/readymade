import { ReactElement, MouseEvent } from "react";

import Icon from "./Icon";
import Tooltip, { TooltipContentType } from "./Tooltip";

type Props = {
  style?: React.CSSProperties;
  className?: string;
  iconClassName?: string;
  children?: ReactElement | undefined | string;
  icon?: React.ComponentType<any>;
  border?: boolean;
  disabled?: boolean;
  tooltip?: TooltipContentType;
  onClick: (ev: MouseEvent) => void;
};

export default function IconButton({
  style,
  className,
  iconClassName,
  children,
  icon,
  border,
  disabled,
  tooltip,
  onClick,
}: Props) {
  return (
    <Tooltip value={tooltip}>
      <div
        style={style}
        className={`cursor-pointer ${className || ""} ${
          border ? "border rounded hover:border-black" : ""
        }`}
        onClick={!disabled ? onClick : undefined}
      >
        {icon ? (
          <Icon
            className={iconClassName ? iconClassName : "hover:stroke-black"}
            value={icon}
          />
        ) : (
          children
        )}
      </div>
    </Tooltip>
  );
}
