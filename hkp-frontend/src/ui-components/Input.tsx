import { Input as InputCN } from "@/components/ui/input";
import PropertyLabel from "./GroupLabel";

type Props = {
  title: string;
  value: string;
  disabled?: boolean;
  onChange: (newValue: string) => void;
};

export default function Input({ title, value, disabled, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 w-full">
      <PropertyLabel className="pt-1">{title}</PropertyLabel>
      <InputCN
        className="w-[80px] border-0 border-none p-0 h-min text-base w-full"
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
