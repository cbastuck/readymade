import { ReactNode, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./primitives/tooltip";
import ExpandableTooltip from "./ExpandableTooltip";
import { TooltipProvider } from "./primitives/tooltip";

export type ExpandableTooltipContent = { text: string; details: ReactNode };
export type TooltipContentType = string | ExpandableTooltipContent;

type Props = {
  value: TooltipContentType | undefined;
  children: ReactNode;
};
export default function Tooltip_({ value, children }: Props) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  if (!value) {
    return children;
  }
  return (
    <TooltipProvider>
      {typeof value === "string" ? (
        <Tooltip>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent>{value}</TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip open={isDetailsOpen || undefined}>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent>
            <ExpandableTooltip
              value={value}
              isExpanded={isDetailsOpen}
              onExpand={() => setIsDetailsOpen(true)}
              onCollapse={() => setIsDetailsOpen(false)}
            />
          </TooltipContent>
        </Tooltip>
      )}
    </TooltipProvider>
  );
}
