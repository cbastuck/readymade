import {
  KeyboardEvent,
  useEffect,
  useState,
  forwardRef,
  FocusEvent,
  useRef,
  useMemo,
} from "react";

import Input from "./Input";
import Tooltip, { TooltipContentType } from "./Tooltip";

export type SubmittableInputProps = {
  id?: string;
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
  autoCompleteValues?: Array<string>;
  tooltip?: TooltipContentType;
  onSubmit: (val: string) => void;
  onTab?: (val: string) => void;
  onChangePending?: (isChangePending: boolean) => void;
};

const SubmittableInput = forwardRef<HTMLInputElement, SubmittableInputProps>(
  (props, ref) => {
    const {
      id,
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
      autoCompleteValues,
      tooltip,
      onSubmit,
      onTab,
      onChangePending,
    } = props;
    const [internal, setInternal] = useState(value);

    const isChangePending = useMemo(
      () => value !== internal,
      [value, internal]
    );

    useEffect(() => {
      setInternal(value);
    }, [value]);

    useEffect(
      () => onChangePending?.(isChangePending),
      [onChangePending, isChangePending]
    );

    const lastSubmittedValue = useRef("");

    const onKeyDown = (ev: KeyboardEvent) => {
      if (onTab && ev.key === "Tab") {
        ev.preventDefault();
        ev.stopPropagation();
        onTab(internal);
      }
    };
    const onKeyUp = (ev: KeyboardEvent) => {
      if (ev.key === "Enter") {
        lastSubmittedValue.current = internal;
        onSubmit(internal);
        return;
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

    const onFocus = (event: FocusEvent<HTMLInputElement>) => {
      selectAllOnFocus && setTimeout(() => event.target.select(), 100);
    };

    const cls = `font-menu text-md ${className}`;
    return (
      <Tooltip value={tooltip}>
        <Input
          id={id}
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
          autoCompleteValues={autoCompleteValues}
          onChange={onChange}
          onKeyUp={onKeyUp}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          onFocus={onFocus}
        />
      </Tooltip>
    );
  }
);

export default SubmittableInput;
