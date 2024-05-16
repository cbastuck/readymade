import { Component } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui-components/primitives/select";

import "./SelectorField.css";
import GroupLabel from "@/ui-components/GroupLabel";

type OnChangeValue = {
  value: string;
  index?: number;
};

type Options = { [key: string]: string };

type Props = {
  value: string | null;
  label?: string;
  options: Options;

  uppercaseValues?: boolean;
  uppercaseKeys?: boolean;
  disabled?: boolean;
  highlight?: string | undefined;
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
  highlight?: string;
};

export default class SelectorField extends Component<Props, State> {
  state: State = {
    optionsVisible: false,
  };

  componentDidUpdate(prevProps: Props) {
    const { highlight } = this.props;

    if (highlight !== prevProps.highlight) {
      this.setState({ highlight });
    }
  }

  render() {
    const {
      value,
      label,
      minWidth = undefined, //"100%",
      options: optionsMap,
      onChange,
    } = this.props;

    const useDefaultLabel = typeof label !== "object";
    const options = Object.keys(optionsMap).map((key) => ({
      text: optionsMap[key],
      value: optionsMap[key],
    }));

    return (
      <div
        className="items-center"
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "row",
          minWidth,
        }}
      >
        {label && (useDefaultLabel ? <div>{label}</div> : label)}

        <Select
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
          <SelectTrigger className="w-full m-2">
            <SelectValue placeholder="Select ..." />
          </SelectTrigger>
          <SelectContent className="font-menu">
            <SelectGroup>
              {/*<SelectLabel>SOME LABLE COULD BE HERE</SelectLabel>*/}

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
