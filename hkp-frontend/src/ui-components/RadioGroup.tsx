import { Label } from "@/components/ui/label";
import {
  RadioGroup as RadioGroupCN,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import GroupLabel from "./GroupLabel";

type Props = {
  id?: string;
  className?: string;
  title: string;
  options: Array<string>;
  value: string | undefined;
  disabled?: boolean;
  alignRight?: boolean;
  onChange: (value: string) => void;
};

export default function RadioGroup({
  id,
  title,
  options,
  value,
  disabled,
  className = "",
  alignRight,
  onChange,
}: Props) {
  const uniqueId = id || crypto.randomUUID();
  return (
    <div className={`flex-col ${alignRight && "text-right"} ${className}`}>
      <GroupLabel
        className={`${disabled && "text-gray-300"} ${
          alignRight && "text-right"
        }`}
      >
        {title}
      </GroupLabel>
      <RadioGroupCN className="py-2 flex" value={value}>
        {options.map((item, idx) => {
          const optionId = `${uniqueId || title}-option-${idx}`;
          return (
            <div key={`${item}.${idx}`} className="flex items-center space-x-2">
              <RadioGroupItem
                value={item}
                id={optionId}
                onClick={() => onChange(item)}
                disabled={disabled}
              />
              <Label
                htmlFor={optionId}
                className="text-base capitalize tracking-widest"
                aria-disabled={disabled}
              >
                {item}
              </Label>
            </div>
          );
        })}
      </RadioGroupCN>
    </div>
  );
}
