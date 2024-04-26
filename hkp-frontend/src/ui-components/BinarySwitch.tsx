import { Switch } from "@/components/ui/switch";
import GroupLabel from "./GroupLabel";

type Props = {
  label: string;
  value: boolean;
  onChange: (newValue: boolean) => void;
};

export default function BinarySwitch({ label, value, onChange }: Props) {
  return (
    <div className="flex my-4">
      <GroupLabel>{label}</GroupLabel>

      <Switch
        className="ml-4 mr-auto mr-4"
        checked={value}
        onCheckedChange={onChange}
      />
    </div>
  );
}
