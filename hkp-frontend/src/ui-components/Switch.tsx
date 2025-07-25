import { Switch as SwitchCN } from "hkp-frontend/src/ui-components/primitives/switch";
import GroupLabel from "./GroupLabel";

type Props = {
  title: string;
  checked: boolean;
  className?: string;
  labelClassName?: string;
  onCheckedChange: (newChecked: boolean) => void;
};

export default function Switch({
  title,
  checked,
  className = "",
  labelClassName = "",
  onCheckedChange,
}: Props) {
  return (
    <div className={`flex gap-2 ${className}`}>
      <GroupLabel className={labelClassName} size={4}>
        {title}
      </GroupLabel>
      <SwitchCN checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
