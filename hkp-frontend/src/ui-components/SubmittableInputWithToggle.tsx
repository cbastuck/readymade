import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";

import { SubmittableInputProps } from "./SubmittableInput";
import IconButton from "./IconButton";
import { SquareFunction } from "lucide-react";
import { TooltipContentType } from "./Tooltip";
import { useThemeControl } from "./ThemeContext";

type Props = SubmittableInputProps & {
  toggleValue: boolean;
  toggleTooltip?: TooltipContentType;
  onToggle: () => void;
};

export default function SubmittableInputWithToggle(props: Props) {
  const { onToggle, value, toggleValue, toggleTooltip } = props;
  const compact = useThemeControl().densityId === "compact";
  return (
    <div className={`flex pr-4 ${compact ? "py-0" : "py-0.5"}`}>
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
