import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";

import { SubmittableInputProps } from "./SubmittableInput";
import IconButton from "./IconButton";
import { SquareFunction } from "lucide-react";
import { TooltipContentType } from "./Tooltip";

type Props = SubmittableInputProps & {
  toggleValue: boolean;
  toggleTooltip?: TooltipContentType;
  onToggle: () => void;
};

export default function SubmittableInputWithToggle(props: Props) {
  const { onToggle, value, toggleValue, toggleTooltip } = props;
  return (
    <div className="flex pr-4 py-1">
      <SubmittableInput {...props} />
      <IconButton
        style={{ display: value ? undefined : "none" }}
        onClick={onToggle}
        tooltip={toggleTooltip}
      >
        <SquareFunction
          size={15}
          stroke={toggleValue ? "rgb(2, 132, 199)" : "gray"}
        />
      </IconButton>
    </div>
  );
}
