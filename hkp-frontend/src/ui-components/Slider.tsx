import { Label } from "@/ui-components/primitives/label";
import Select from "@/ui-components/Select";
import { Slider as SliderCN } from "@/ui-components/primitives/slider";
import PropertyLabel from "./GroupLabel";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui-components/primitives/popover";
import SubmittableInput from "./SubmittableInput";
import { useState } from "react";

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
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
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

          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Label className="ml-auto pl-2 text-lg cursor-text hover:text-accent">
                {` ${value} `}
              </Label>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="flex items-end gap-4 w-full">
                <h2 className="text-xl whitespace-nowrap">Enter value</h2>
                <SubmittableInput
                  className="w-full"
                  type="number"
                  value={`${value}`}
                  onSubmit={(val) => {
                    const n = Number(val);
                    if (!isNaN(n)) {
                      onChange(n);
                      setIsPopoverOpen(false);
                    }
                  }}
                  submitOnBlur={false}
                />
              </div>
            </PopoverContent>
          </Popover>

          {units && onUnit && (
            <Select options={units} value={unit} onChange={onUnit} />
          )}
        </div>
      </div>
    </div>
  );
}
