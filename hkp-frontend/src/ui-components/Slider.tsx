import { Label } from "@/components/ui/label";
import Select from "@/ui-components/Select";
import { Slider as SliderCN } from "@/components/ui/slider";
import PropertyLabel from "./PropertyLabel";

type Props = {
  title?: string;
  value: number;
  unit?: string;
  units?: Array<string>;
  onChange: (newValue: number, unit?: string) => void;
  onUnit?: (newUnit: string) => void;
};

export default function Slider({
  title,
  value,
  units,
  unit,
  onChange,
  onUnit,
}: Props) {
  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex gap-2 items-end h-min">
        {title && <PropertyLabel>{title}</PropertyLabel>}
        <div className="flex gap-2 w-full">
          <SliderCN value={[value]} onValueChange={(val) => onChange(val[0])} />
          <Label className="ml-auto pl-2 text-lg"> {value}</Label>
          {units && onUnit && (
            <Select options={units} value={unit} onChange={onUnit} />
          )}
        </div>
      </div>
    </div>
  );
}
