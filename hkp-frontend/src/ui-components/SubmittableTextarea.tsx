import {
  KeyboardEvent,
  useEffect,
  useState,
  forwardRef,
  FocusEvent,
  useRef,
} from "react";

import { Textarea } from "hkp-frontend/src/ui-components/primitives/textarea";
import GroupLabel from "./GroupLabel";

type SubmittableInputProps = {
  className?: string;
  title?: string;
  type?: string;
  value: string;
  selectAllOnFocus?: boolean;
  disabled?: boolean;
  placeholder?: string;
  submitOnBlur?: boolean;
  rows?: number;
  onSubmit: (val: string) => void;
  onBlur?: (val: string) => void;
  onChangePending?: (isChangePending: boolean) => void;
};
const SubmittableTextarea = forwardRef<
  HTMLTextAreaElement,
  SubmittableInputProps
>((props, ref) => {
  const {
    className,
    title,
    value,
    selectAllOnFocus,
    disabled = false,
    placeholder,
    rows = undefined,
    onSubmit,
    onBlur,
    onChangePending,
  } = props;
  const [internal, setInternal] = useState(value);
  useEffect(() => setInternal(value), [value]);

  const isChangePending = value !== internal;
  useEffect(
    () => onChangePending?.(isChangePending),
    [onChangePending, isChangePending]
  );

  const lastSubmittedValue = useRef<string | null>(null);
  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === "Enter" && ev.metaKey) {
      lastSubmittedValue.current = internal;
      onSubmit(internal);
    }
  };
  const onChange = (ev: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInternal(ev.target.value);
  };

  const onBlurInternal = () => {
    if (internal !== lastSubmittedValue.current) {
      onBlur?.(internal);
    }
  };

  const onFocus = (event: FocusEvent<HTMLTextAreaElement>) =>
    selectAllOnFocus && setTimeout(() => event.target.select(), 10);

  return (
    <div className="flex flex-col h-full w-full">
      {title && (
        <GroupLabel className="pt-1 whitespace-nowrap">{title}</GroupLabel>
      )}
      <Textarea
        ref={ref}
        className={className}
        title={title}
        value={internal}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onBlur={onBlurInternal}
        onFocus={onFocus}
      />
    </div>
  );
});

export default SubmittableTextarea;
