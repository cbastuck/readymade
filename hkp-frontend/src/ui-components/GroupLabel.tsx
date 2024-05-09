import { ReactNode } from "react";

type Props = {
  children: string | ReactNode;
  className?: string;
  size?: 1 | 2 | 3 | 4;
};

export default function GroupLabel({
  children,
  size = 3,
  className = "",
}: Props) {
  const cn = `text-left tracking-[6px] ${className}`;
  switch (size) {
    case 1:
      return <h1 className={cn}>{children}</h1>;
    case 2:
      return <h2 className={cn}>{children}</h2>;
    case 4:
      return <h4 className={cn}>{children}</h4>;
    default:
    case 3:
      return <h3 className={cn}>{children}</h3>;
  }
}
