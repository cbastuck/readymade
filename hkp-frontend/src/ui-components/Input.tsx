import { KeyboardEvent, FocusEvent, forwardRef } from "react";

import { Input as InputCN } from "@/ui-components/primitives/input";
import PropertyLabel from "./GroupLabel";

type Props = {
  className?: string;
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
    className,
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
  const h = minHeight ? "h-min mt-2 pl-1 text-base" : "";
  const bottomBorder = hideBottomBorder
    ? "border-none"
    : "border-t-0 border-b-1";
  return (
    <div className="flex items-center gap-2 w-full">
      {title && (
        <PropertyLabel className="pt-1 whitespace-nowrap">
          {title}
        </PropertyLabel>
      )}
      <InputCN
        ref={ref}
        type={type}
        className={`m-0 p-0 text-base border-x-0 ${bottomBorder} rounded-none ${w} ${h} ${className} `}
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
