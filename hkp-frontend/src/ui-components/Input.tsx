import { Input as InputCN } from "@/components/ui/input";
import PropertyLabel from "./GroupLabel";

type Props = {
  title: string;
  value: string;
  disabled?: boolean;
  fullWidth?: boolean;
  onChange: (newValue: string) => void;
};

export default function Input({
  title,
  fullWidth,
  value,
  disabled,
  onChange,
}: Props) {
  const w = fullWidth ? "" : "w-[80px]";
  return (
    <div className="flex items-center gap-2 w-full">
      <PropertyLabel className="pt-1">{title}</PropertyLabel>
      <InputCN
        className={`m-0 p-0 h-min text-base border-x-0 border-t-0 border-b-1 rounded-none ${w}`}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
