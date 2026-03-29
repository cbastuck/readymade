import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "hkp-frontend/src/ui-components/primitives/select";

import "./SelectorField.css";
import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";

export type OnChangeValue = {
  value: string;
  index: number;
};

type Options = { [key: string]: string };

type Props = {
  value: string | null;
  label?: string;
  options: Options;
  className?: string;
  uppercaseValues?: boolean;
  uppercaseKeys?: boolean;
  disabled?: boolean;
  style?: object;
  minWidth?: string | number;
  placeholder?: string;
  labelStyle?: object;
  maxHeight?: string;

  onChange: (value: OnChangeValue) => void;
  onOpen?: (options: Options) => void;
};

export default function SelectorField({
  value,
  label,
  minWidth = undefined,
  options: optionsMap,
  disabled = false,
  className,
  onChange,
  onOpen,
}: Props) {
  const useDefaultLabel = typeof label !== "object";
  const options = Object.keys(optionsMap).map((key) => ({
    text: optionsMap[key],
    value: key,
  }));

  return (
    <div
      className={`items-end ${className || ""}`}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "row",
        minWidth,
      }}
    >
      {label &&
        (useDefaultLabel ? (
          <GroupLabel className="mb-1">{label}</GroupLabel>
        ) : (
          label
        ))}

      <Select
        disabled={disabled}
        value={value || undefined}
        onOpenChange={(isOpen) =>
          isOpen && onOpen?.(optionsMap)
        }
        onValueChange={(newValue) =>
          onChange({
            index: options.findIndex((x) => x.value === newValue),
            value: newValue,
          })
        }
      >
        <SelectTrigger className="w-full h-min rounded-none">
          <SelectValue className="font-menu" placeholder="Select ..." />
        </SelectTrigger>
        <SelectContent className="font-menu">
          <SelectGroup>
            {/*<SelectLabel>SOME LABEL COULD GO HERE</SelectLabel>*/}
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.text}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export function arrayToOptions(arr: Array<string>): { [key: string]: string } {
  return arr.reduce((all, cur) => ({ ...all, [cur]: cur }), {});
}
