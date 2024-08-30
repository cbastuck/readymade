import { ReactElement } from "react";

type Props = {
  children?: ReactElement | undefined | string;
  icon?: React.ComponentType<any>;
  onClick: () => void;
};

export default function IconButton({ children, icon: Icon, onClick }: Props) {
  return (
    <button onClick={onClick}>
      {Icon ? <Icon className="hover:stroke-black" size={16} /> : children}
    </button>
  );
}
