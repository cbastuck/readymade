import { ReactNode } from "react";

type Props = {
  children: string | ReactNode;
  className?: string;
};

export default function GroupLabel({ children, className = "" }: Props) {
  return (
    <h3 className={`text-left tracking-[6px] text-base ${className}`}>
      {children}
    </h3>
  );
}
