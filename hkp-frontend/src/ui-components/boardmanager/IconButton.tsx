import { ReactElement } from "react";

type Props = {
  className?: string;
  children?: ReactElement | undefined | string;
  icon?: React.ComponentType<any>;
  onClick: () => void;
};

export default function IconButton({
  className,
  children,
  icon: Icon,
  onClick,
}: Props) {
  return (
    <button className={className} onClick={onClick}>
      {Icon ? <Icon className="hover:stroke-black" size={16} /> : children}
    </button>
  );
}
