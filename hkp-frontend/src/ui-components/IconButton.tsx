import { ReactElement } from "react";

import Icon from "./Icon";

type Props = {
  className?: string;
  children?: ReactElement | undefined | string;
  icon?: React.ComponentType<any>;
  border?: boolean;
  onClick: () => void;
};

export default function IconButton({
  className,
  children,
  icon,
  border,
  onClick,
}: Props) {
  return (
    <button
      className={`${className || ""} ${
        border ? "border rounded hover:border-black" : ""
      }`}
      onClick={onClick}
    >
      {icon ? <Icon className="hover:stroke-black" value={icon} /> : children}
    </button>
  );
}
