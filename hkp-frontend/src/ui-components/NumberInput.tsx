import { Input as InputCN } from "@/components/ui/input";
import PropertyLabel from "./GroupLabel";

type Props = {
  title: string;
  value: number;
  disabled?: boolean;
  onChange: (newValue: number) => void;
};

export default function NumberInput({
  title,
  value,
  disabled,
  onChange,
}: Props) {
  return (
    <div className="flex items-end gap-2">
      <PropertyLabel>{title}</PropertyLabel>
      <InputCN
        className="w-[80px] border-0 border-none p-0 h-min text-lg"
        type="number"
        value={value}
        onChange={(ev) => onChange(Number(ev.target.value))}
        disabled={disabled}
      />
    </div>
  );
}
