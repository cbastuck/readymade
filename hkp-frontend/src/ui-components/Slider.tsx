import { useState } from "react";

import { Label } from "hkp-frontend/src/ui-components/primitives/label";
import Select from "hkp-frontend/src/ui-components/Select";
import { Slider as SliderCN } from "hkp-frontend/src/ui-components/primitives/slider";
import PropertyLabel from "./GroupLabel";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "hkp-frontend/src/ui-components/primitives/popover";
import SubmittableInput from "./SubmittableInput";
import { useThemeControl } from "hkp-frontend/src/ui-components/ThemeContext";
import GroupLabel from "./GroupLabel";

type Props = {
  className?: string;
  title?: string;
  value: number;
  unit?: string;
  units?: Array<string>;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange: (newValue: number, unit?: string) => void;
  onUnit?: (newUnit: string) => void;
};

export default function Slider({
  className,
  title,
  value: valueProp,
  units,
  unit,
  min: minProp,
  max: maxProp,
  step,
  disabled,
  onChange,
  onUnit,
}: Props) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { themeName } = useThemeControl();
  const isPlayground = themeName === "playground";

  const min = !step ? minProp : 0;
  const max = !step ? maxProp : 100;
  const range = (maxProp || 100) - (minProp || 0);

  const absoluteToRelative = (absolute: number) =>
    Math.round((absolute / range) * 100);

  const relativeToAbsolute = (relative: number) =>
    (relative / 100) * range + (minProp || 0);

  const clamp = (absolute: number) =>
    Math.max(minProp || 0, Math.min(absolute, maxProp || 100));

  const value = !step ? valueProp : absoluteToRelative(valueProp);
  const onValueChanged = (val: number[]) => {
    const v = !step ? val[0] : relativeToAbsolute(val[0]);
    onChange(clamp(v));
  };

  if (isPlayground) {
    const hasUnitSelector = units && units.length > 1 && onUnit;
    return (
      <div className={`flex flex-col ${className ?? ""}`}>
        {title && <GroupLabel size={4}>{title}</GroupLabel>}
        <div
          className="mx-2"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <input
            type="range"
            className="hkp-range-slider"
            min={min}
            max={max}
            value={value}
            step={step ?? 1}
            disabled={disabled}
            onChange={(e) => onValueChanged([Number(e.target.value)])}
          />
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <span className="text-base">
                {valueProp}
                {!hasUnitSelector && unit ? ` ${unit}` : ""}
              </span>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="flex items-end gap-4 w-full">
                <h2 className="text-xl whitespace-nowrap">Enter value</h2>
                <SubmittableInput
                  className="w-full"
                  type="number"
                  value={`${valueProp}`}
                  onSubmit={(val) => {
                    const n = Number(val);
                    if (!isNaN(n)) {
                      onChange(clamp(n));
                      setIsPopoverOpen(false);
                    }
                  }}
                  submitOnBlur={false}
                />
              </div>
            </PopoverContent>
          </Popover>
          {hasUnitSelector && (
            <Select options={units} value={unit} onChange={onUnit} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 h-full w-full ${className}`}>
      <div className="flex gap-2 items-end h-min">
        {title && <PropertyLabel size={4}>{title}</PropertyLabel>}
        <div className="flex gap-2 w-full">
          <SliderCN
            min={min}
            max={max}
            value={[value]}
            onValueChange={onValueChanged}
            disabled={disabled}
          />
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Label className="ml-auto pl-2 text-lg cursor-text hover:text-accent">
                {` ${valueProp} `}
              </Label>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="flex items-end gap-4 w-full">
                <h2 className="text-xl whitespace-nowrap">Enter value</h2>
                <SubmittableInput
                  className="w-full"
                  type="number"
                  value={`${valueProp}`}
                  onSubmit={(val) => {
                    const n = Number(val);
                    if (!isNaN(n)) {
                      onChange(clamp(n));
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
