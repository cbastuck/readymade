import { Component } from "react";
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

type State = {
  optionsVisible: boolean;
};

export default class SelectorField extends Component<Props, State> {
  state: State = {
    optionsVisible: false,
  };

  render() {
    const {
      value,
      label,
      minWidth = undefined, //"100%",
      options: optionsMap,
      disabled = false,
      onChange,
    } = this.props;

    const useDefaultLabel = typeof label !== "object";
    const options = Object.keys(optionsMap).map((key) => ({
      text: optionsMap[key],
      value: key,
    }));

    return (
      <div
        className={`items-end ${this.props.className || ""}`}
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
            isOpen && this.props.onOpen?.(this.props.options)
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
}

export function arrayToOptions(arr: Array<string>): { [key: string]: string } {
  return arr.reduce((all, cur) => ({ ...all, [cur]: cur }), {});
}
