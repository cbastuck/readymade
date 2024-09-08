import {
  KeyboardEvent,
  useEffect,
  useState,
  forwardRef,
  FocusEvent,
  useRef,
} from "react";

import Input from "./Input";

type SubmittableInputProps = {
  className?: string;
  title?: string;
  type?: string;
  value: string;
  selectAllOnFocus?: boolean;
  fullWidth?: boolean;
  minHeight?: boolean;
  hideBottomBorder?: boolean;
  disabled?: boolean;
  placeholder?: string;
  submitOnBlur?: boolean;
  onSubmit: (val: string) => void;
  onChangePending?: (isChangePending: boolean) => void;
};
const SubmittableInput = forwardRef<HTMLInputElement, SubmittableInputProps>(
  (props, ref) => {
    const {
      className,
      type,
      title,
      value,
      selectAllOnFocus,
      hideBottomBorder,
      fullWidth,
      minHeight = true,
      disabled = false,
      submitOnBlur = true,
      placeholder,
      onSubmit,
      onChangePending,
    } = props;
    const [internal, setInternal] = useState(value);
    useEffect(() => setInternal(value), [value]);

    const isChangePending = value !== internal;
    useEffect(
      () => onChangePending?.(isChangePending),
      [onChangePending, isChangePending]
    );

    const lastSubmittedValue = useRef("");
    const onKeyUp = (ev: KeyboardEvent) => {
      if (ev.key === "Enter") {
        lastSubmittedValue.current = internal;
        onSubmit(internal);
      }
    };

    const onChange = (newValue: string) => {
      setInternal(newValue);
    };

    const onBlur = () => {
      if (submitOnBlur && internal !== lastSubmittedValue.current) {
        onSubmit(internal);
      }
    };

    const onFocus = (event: FocusEvent<HTMLInputElement>) =>
      selectAllOnFocus && setTimeout(() => event.target.select(), 10);

    const cls = `font-menu text-md ${className}`;
    return (
      <Input
        ref={ref}
        className={cls}
        type={type}
        fullWidth={fullWidth}
        minHeight={minHeight}
        hideBottomBorder={hideBottomBorder}
        title={title}
        value={internal}
        disabled={disabled}
        placeholder={placeholder}
        onChange={onChange}
        onKeyUp={onKeyUp}
        onBlur={onBlur}
        onFocus={onFocus}
      />
    );
  }
);

export default SubmittableInput;
