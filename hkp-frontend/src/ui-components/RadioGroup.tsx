import { Label } from "@/ui-components/primitives/label";
import {
  RadioGroup as RadioGroupCN,
  RadioGroupItem,
} from "@/ui-components/primitives/radio-group";
import GroupLabel from "./GroupLabel";

type Props = {
  id?: string;
  className?: string;
  title: string;
  options: Array<string> | { [value: string]: string };
  value: string | undefined;
  disabled?: boolean;
  alignRight?: boolean;
  vertical?: boolean;
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
  vertical,
  onChange,
}: Props) {
  const uniqueId = id || crypto.randomUUID();
  const values = Array.isArray(options) ? options : Object.keys(options);
  const labels = Array.isArray(options)
    ? options
    : values.map((val) => options[val]);
  return (
    <div className={`flex-col ${alignRight && "text-right"} ${className}`}>
      <GroupLabel
        className={`${disabled && "text-gray-300"} ${
          alignRight && "text-right"
        }`}
      >
        {title}
      </GroupLabel>
      <RadioGroupCN
        disabled={disabled}
        className={`py-2 flex ${vertical ? "flex-col" : ""}`}
        value={value}
      >
        {values.map((item, idx) => {
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
                {labels[idx]}
              </Label>
            </div>
          );
        })}
      </RadioGroupCN>
    </div>
  );
}
