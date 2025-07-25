import { Label } from "hkp-frontend/src/ui-components/primitives/label";
import { Checkbox } from "hkp-frontend/src/ui-components/primitives/checkbox";
import GroupLabel from "./GroupLabel";

type Props = {
  id?: string;
  className?: string;
  title: string;
  options: Array<string>;
  values: Array<string>;
  disabled?: boolean;
  alignRight?: boolean;
  vertical?: boolean;
  onChange: (value: string, checked: boolean) => void;
};

export default function CheckboxGroup({
  id,
  title,
  options,
  values,
  disabled,
  className = "",
  alignRight,
  vertical,
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
      <div className={`py-2 flex ${vertical ? "flex-col gap-2" : ""}`}>
        {options.map((item, idx) => {
          const optionId = `${uniqueId || title}-option-${idx}`;
          return (
            <div key={`${item}.${idx}`} className="flex items-center space-x-2">
              <Checkbox
                id={optionId}
                checked={values.indexOf(item) !== -1}
                onCheckedChange={(checked: boolean) => onChange(item, checked)}
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
      </div>
    </div>
  );
}
