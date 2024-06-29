import { Label } from "@/ui-components/primitives/label";
import Select from "@/ui-components/Select";
import { Slider as SliderCN } from "@/ui-components/primitives/slider";
import PropertyLabel from "./GroupLabel";

type Props = {
  title?: string;
  value: number;
  unit?: string;
  units?: Array<string>;
  min?: number;
  max?: number;
  onChange: (newValue: number, unit?: string) => void;
  onUnit?: (newUnit: string) => void;
};

export default function Slider({
  title,
  value,
  units,
  unit,
  min,
  max,
  onChange,
  onUnit,
}: Props) {
  return (
    <div className="flex flex-col gap-2 h-full w-full">
      <div className="flex gap-2 items-end h-min">
        {title && <PropertyLabel>{title}</PropertyLabel>}
        <div className="flex gap-2 w-full">
          <SliderCN
            min={min}
            max={max}
            value={[value]}
            onValueChange={(val) => onChange(val[0])}
          />
          <Label className="ml-auto pl-2 text-lg"> {value}</Label>
          {units && onUnit && (
            <Select options={units} value={unit} onChange={onUnit} />
          )}
        </div>
      </div>
    </div>
  );
}
