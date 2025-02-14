import { ReactNode, useMemo } from "react";

import Tooltip, { TooltipContentType } from "./Tooltip";

type Props = {
  children: string | ReactNode;
  className?: string;
  size?: 1 | 2 | 3 | 4;
  tooltip?: TooltipContentType;
  disabled?: boolean;
};

export default function GroupLabel({
  children,
  size = 3,
  className = "",
  tooltip,
  disabled,
}: Props) {
  const c = useMemo(
    () =>
      tooltip ? (
        <Tooltip value={tooltip}>
          <div>{children}</div>
        </Tooltip>
      ) : (
        children
      ),
    [tooltip, children]
  );

  const textColor = disabled ? "text-gray-400" : "";
  const cn = `text-left tracking-[6px] ${textColor} ${className}`;
  switch (size) {
    case 1:
      return <h1 className={cn}>{c}</h1>;
    case 2:
      return <h2 className={cn}>{c}</h2>;
    case 4:
      return <h4 className={cn}>{c}</h4>;
    default:
    case 3:
      return <h3 className={cn}>{c}</h3>;
  }
}
