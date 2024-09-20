import { ReactNode } from "react";
import Button from "./Button";
import CustomDialog from "./CustomDialog";
import { ExpandableTooltipContent } from "./Tooltip";

type Props = {
  value: ExpandableTooltipContent;
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
};

export default function ExpandableTooltip({
  value,
  isExpanded,
  onExpand,
  onCollapse,
}: Props) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        {value.text}
        <Button size="sm" onClick={onExpand}>
          More
        </Button>
      </div>
      <CustomDialog
        isOpen={isExpanded}
        title="Context Assist"
        onOpenChange={(isOpen) => !isOpen && onCollapse()}
      >
        {value.details}
      </CustomDialog>
    </div>
  );
}

export function createExpandableTooltip(
  text: string,
  expandedContent: ReactNode
): ExpandableTooltipContent {
  return { text, details: expandedContent };
}
