import { ReactElement } from "react";

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
  icon: Icon,
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
      {Icon ? <Icon className="hover:stroke-black" size={16} /> : children}
    </button>
  );
}
