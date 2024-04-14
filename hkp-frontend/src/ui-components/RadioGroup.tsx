import { Label } from "@/components/ui/label";
import {
  RadioGroup as RadioGroupCN,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import PropertyLabel from "./PropertyLabel";

type Props = {
  title: string;
  items: Array<string>;
  initial: number;
  onChange: (item: string) => void;
};

export default function RadioGroup({ title, items, initial, onChange }: Props) {
  return (
    <div className="flex-col">
      <PropertyLabel>{title}</PropertyLabel>
      <RadioGroupCN className="py-2 flex" defaultValue={items[initial]}>
        {items.map((item, idx) => (
          <div key={`${item}.${idx}`} className="flex items-center space-x-2">
            <RadioGroupItem
              value={item}
              id={`r${idx}`}
              onClick={() => onChange(item)}
            />
            <Label
              htmlFor={`r${idx}`}
              className="text-base capitalize tracking-widest"
            >
              {item}
            </Label>
          </div>
        ))}
      </RadioGroupCN>
    </div>
  );
}
