import { Input as InputCN } from "@/components/ui/input";
import PropertyLabel from "./GroupLabel";

type Props = {
  title: string;
  value: string;
  onChange: (newValue: string) => void;
};

export default function Input({ title, value, onChange }: Props) {
  return (
    <div className="flex items-end gap-2 w-full">
      <PropertyLabel>{title}</PropertyLabel>
      <InputCN
        className="w-[80px] border-0 border-none p-0 h-min text-lg w-full"
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
      />
    </div>
  );
}
