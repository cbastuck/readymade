import { KeyboardEvent, FocusEvent, forwardRef } from "react";

import { Input as InputCN } from "@/ui-components/primitives/input";
import PropertyLabel from "./GroupLabel";

type Props = {
  title?: string;
  type?: string;
  value: string;
  disabled?: boolean;
  fullWidth?: boolean;
  minHeight?: boolean;
  hideBottomBorder?: boolean;
  placeholder?: string;
  onChange: (newValue: string) => void;
  onKeyUp?: (ev: KeyboardEvent) => void;
  onBlur?: (ev: FocusEvent<HTMLInputElement>) => void;
  onFocus?: (ev: FocusEvent<HTMLInputElement>) => void;
};

const InputWithRef = forwardRef<HTMLInputElement, Props>((props, ref) => {
  const {
    title,
    type,
    fullWidth,
    minHeight,
    hideBottomBorder,
    value,
    disabled,
    placeholder,
    onChange,
    onKeyUp,
    onBlur,
    onFocus,
  } = props;
  const w = fullWidth ? "" : "w-[80px]";
  const h = minHeight ? "h-min" : "";
  const bottomBorder = hideBottomBorder
    ? "border-none"
    : "border-t-0 border-b-1";
  return (
    <div className="flex items-center gap-2 w-full">
      {title && <PropertyLabel className="pt-1">{title}</PropertyLabel>}
      <InputCN
        ref={ref}
        type={type}
        className={`m-0 p-0 text-base border-x-0 ${bottomBorder} rounded-none ${w} ${h}`}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        disabled={disabled}
        spellCheck={false}
        placeholder={placeholder}
        onKeyUp={onKeyUp}
        onBlur={onBlur}
        onFocus={onFocus}
      />
    </div>
  );
});

export default InputWithRef;
