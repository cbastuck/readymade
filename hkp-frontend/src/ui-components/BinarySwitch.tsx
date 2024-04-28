import { Switch } from "@/components/ui/switch";

type Props = {
  label: string;
  value: boolean;
  onChange: (newValue: boolean) => void;
};

export default function BinarySwitch({ label, value, onChange }: Props) {
  return (
    <div className="flex items-end my-4">
      <div className="text-base p-0">{label}</div>
      <Switch
        className="ml-4 mr-auto"
        checked={value}
        onCheckedChange={onChange}
      />
    </div>
  );
}
