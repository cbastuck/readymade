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
  value: string;
  onChange: (value: string) => void;
};

export default function RadioGroup({
  id,
  title,
  options,
  value,
  className = "",
  onChange,
}: Props) {
  const uniqueId = id || crypto.randomUUID();
  return (
    <div className={`flex-col ${className}`}>
      <GroupLabel>{title}</GroupLabel>
      <RadioGroupCN className="py-2 flex" value={value}>
        {options.map((item, idx) => {
          const optionId = `${uniqueId || title}-option-${idx}`;
          return (
            <div key={`${item}.${idx}`} className="flex items-center space-x-2">
              <RadioGroupItem
                value={item}
                id={optionId}
                onClick={() => onChange(item)}
              />
              <Label
                htmlFor={optionId}
                className="text-base capitalize tracking-widest"
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
