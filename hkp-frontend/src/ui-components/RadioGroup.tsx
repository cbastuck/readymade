import { Label } from "@/components/ui/label";
import {
  RadioGroup as RadioGroupCN,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import PropertyLabel from "./GroupLabel";

type Props = {
  id?: string;
  title: string;
  options: Array<string>;
  value: string;
  onChange: (item: string) => void;
};

export default function RadioGroup({
  id,
  title,
  options,
  value,
  onChange,
}: Props) {
  return (
    <div className="flex-col">
      <PropertyLabel>{title}</PropertyLabel>
      <RadioGroupCN className="py-2 flex" value={value}>
        {options.map((item, idx) => {
          const optionId = `${id || title}-option-${idx}`;
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
