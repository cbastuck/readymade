import { KeyboardEvent, FocusEvent, forwardRef, ChangeEvent } from "react";

import { Input as InputCN } from "hkp-frontend/src/ui-components/primitives/input";
import GroupLabel from "./GroupLabel";

type Props = {
  id?: string;
  className?: string;
  labelClassName?: string;
  title?: string;
  type?: string;
  value: string;
  disabled?: boolean;
  fullWidth?: boolean;
  minHeight?: boolean;
  hideBottomBorder?: boolean;
  placeholder?: string;
  autoCompleteValues?: Array<string>;
  onChange: (newValue: string) => void;
  onKeyUp?: (ev: KeyboardEvent) => void;
  onKeyDown?: (ev: KeyboardEvent) => void;
  onBlur?: (ev: FocusEvent<HTMLInputElement>) => void;
  onFocus?: (ev: FocusEvent<HTMLInputElement>) => void;
};

const InputWithRef = forwardRef<HTMLInputElement, Props>((props, ref) => {
  const {
    id,
    className,
    labelClassName,
    title,
    type,
    fullWidth,
    minHeight,
    hideBottomBorder,
    value,
    disabled,
    placeholder,
    autoCompleteValues,
    onChange,
    onKeyUp,
    onKeyDown,
    onBlur,
    onFocus,
  } = props;
  const w = fullWidth ? "" : "w-[80px]";
  const h = minHeight ? "h-min pl-1 text-base" : "h-full"; //"h-[25px]";
  const bottomBorder = hideBottomBorder
    ? "border-none"
    : "border-t-0 border-b-1";

  const onInputChange = (ev: ChangeEvent<HTMLInputElement>) => {
    const val = ev.target.value;
    onChange(val);
  };

  return (
    <div className={`flex items-center h-full w-full gap-2`}>
      {title && (
        <GroupLabel
          size={4}
          className={`pt-0 whitespace-nowrap ${labelClassName}`}
          disabled={disabled}
        >
          {title}
        </GroupLabel>
      )}
      <InputCN
        id={id}
        ref={ref}
        type={type}
        className={`m-0 p-0 border-x-0 ${bottomBorder} rounded-none ${w} ${h} ${className} text-ellipsis `}
        value={value}
        onChange={onInputChange}
        disabled={disabled}
        spellCheck={false}
        placeholder={placeholder}
        autoCompleteValues={autoCompleteValues}
        onKeyUp={onKeyUp}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
      />
    </div>
  );
});

export default InputWithRef;
