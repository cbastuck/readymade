import { Switch as SwitchCN } from "@/ui-components/primitives/switch";
import GroupLabel from "./GroupLabel";

type Props = {
  title: string;
  checked: boolean;
  className?: string;
  onCheckedChange: (newChecked: boolean) => void;
};

export default function Switch({
  title,
  checked,
  className = "",
  onCheckedChange,
}: Props) {
  return (
    <div className={`flex gap-2 ${className}`}>
      <GroupLabel>{title}</GroupLabel>
      <SwitchCN checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
