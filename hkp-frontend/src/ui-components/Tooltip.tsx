import { ReactNode, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./primitives/tooltip";
import ExpandableTooltip from "./ExpandableTooltip";
import { TooltipProvider } from "./primitives/tooltip";

export type CustomTooltipActions = {
  text: string;
  actions: ReactNode;
};

export type ExpandableTooltipContent = {
  text: string;
  details: ReactNode;
};

export type TooltipContentType =
  | string
  | ExpandableTooltipContent
  | CustomTooltipActions;

type Props = {
  value: TooltipContentType | undefined;
  children: ReactNode;
};

export default function Tooltip_({ value, children }: Props) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  if (!value) {
    return children;
  }
  const isExpandable = isExpandableTooltipContent(value);
  const isCustomActions = isCustomTooltipActions(value);
  return (
    <TooltipProvider>
      {typeof value === "string" && (
        <Tooltip>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent>{value}</TooltipContent>
        </Tooltip>
      )}
      {isCustomActions && (
        <Tooltip>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center cursor-default">
              {value.text} {value.actions}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
      {isExpandable && (
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

function isExpandableTooltipContent(obj: any): obj is ExpandableTooltipContent {
  return !!(obj.text && obj.details);
}

function isCustomTooltipActions(obj: any): obj is CustomTooltipActions {
  return !!(obj.text && obj.actions);
}
