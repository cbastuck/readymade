import {
  KeyboardEvent,
  useEffect,
  useState,
  forwardRef,
  FocusEvent,
} from "react";

import Input from "./Input";

type SubmittableInputProps = {
  title?: string;
  value: string;
  selectAllOnFocus?: boolean;
  fullWidth?: boolean;
  minHeight?: boolean;
  hideBottomBorder?: boolean;
  onSubmit: (val: string) => void;
  onChangePending?: (isChangePending: boolean) => void;
};
const SubmittableInput = forwardRef<HTMLInputElement, SubmittableInputProps>(
  (props, ref) => {
    const {
      title,
      value,
      selectAllOnFocus,
      hideBottomBorder,
      fullWidth,
      minHeight = true,
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

    const onKeyUp = (ev: KeyboardEvent) => {
      if (ev.key === "Enter") {
        onSubmit(internal);
      }
    };
    const onChange = (newValue: string) => {
      setInternal(newValue);
    };

    const onBlur = () => onSubmit(internal);

    const onFocus = (event: FocusEvent<HTMLInputElement>) =>
      selectAllOnFocus && setTimeout(() => event.target.select(), 10);

    return (
      <Input
        ref={ref}
        fullWidth={fullWidth}
        minHeight={minHeight}
        hideBottomBorder={hideBottomBorder}
        title={title}
        value={internal}
        onChange={onChange}
        onKeyUp={onKeyUp}
        onBlur={onBlur}
        onFocus={onFocus}
      />
    );
  }
);

export default SubmittableInput;
