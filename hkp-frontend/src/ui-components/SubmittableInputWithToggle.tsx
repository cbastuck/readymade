import SubmittableInput from "@/ui-components/SubmittableInput";

import { SubmittableInputProps } from "./SubmittableInput";
import IconButton from "./IconButton";
import { SquareFunction } from "lucide-react";

type Props = SubmittableInputProps & {
  toggleValue: boolean;
  onToggle: () => void;
};

export default function SubmittableInputWithToggle(props: Props) {
  const { onToggle, value, toggleValue } = props;
  return (
    <div className="flex pr-4 items-end">
      <SubmittableInput {...props} />
      <IconButton
        style={{ display: value ? undefined : "none" }}
        onClick={onToggle}
      >
        <SquareFunction
          size={15}
          stroke={toggleValue ? "black" : "lightgray"}
        />
      </IconButton>
    </div>
  );
}
