import {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useState,
  forwardRef,
  FocusEvent,
} from "react";
import { Input } from "@/components/ui/input";

type SubmittableInputProps = {
  value: string;
  selectAllOnFocus?: boolean;
  onSubmit: (val: string) => void;
  onChangePending?: (isChangePending: boolean) => void;
};
const SubmittableInput = forwardRef<HTMLInputElement, SubmittableInputProps>(
  (props, ref) => {
    const { value, selectAllOnFocus, onSubmit, onChangePending } = props;
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
    const onChange = (ev: ChangeEvent<HTMLInputElement>) => {
      setInternal(ev.target.value);
    };

    const onBlur = () => onSubmit(internal);

    const onFocus = (event: FocusEvent<HTMLInputElement>) =>
      selectAllOnFocus && setTimeout(() => event.target.select(), 10);

    return (
      <Input
        ref={ref}
        className="text-base border-none p-0"
        value={internal}
        onChange={onChange}
        onKeyUp={onKeyUp}
        onBlur={onBlur}
        spellCheck={false}
        onFocus={onFocus}
      />
    );
  }
);

export default SubmittableInput;
