import { Switch as SwitchCN } from "@/ui-components/primitives/switch";
import GroupLabel from "./GroupLabel";

type Props = {
  title: string;
  checked: boolean;
  onCheckedChange: (newChecked: boolean) => void;
};

export default function Switch({ title, checked, onCheckedChange }: Props) {
  return (
    <div className="flex gap-2">
      <GroupLabel>{title}</GroupLabel>
      <SwitchCN checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
