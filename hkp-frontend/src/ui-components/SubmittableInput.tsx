import {
  KeyboardEvent,
  useEffect,
  useState,
  forwardRef,
  FocusEvent,
  useRef,
  useMemo,
} from "react";
import { Maximize } from "lucide-react";

import Input from "./Input";
import Tooltip, { TooltipContentType } from "./Tooltip";
import EditorDialog from "./EditorDialog";
import Button from "./Button";

export type SubmittableInputProps = {
  id?: string;
  className?: string;
  labelClassName?: string;
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
  isExpandable?: boolean;
  showBackground?: boolean;
  onSubmit: (val: string) => void;
  onTab?: (val: string) => void;
  onChangePending?: (isChangePending: boolean) => void;
};

const SubmittableInput = forwardRef<HTMLInputElement, SubmittableInputProps>(
  (props, ref) => {
    const {
      id,
      className,
      labelClassName,
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
      isExpandable,
      showBackground,
      onSubmit,
      onTab,
      onChangePending,
    } = props;
    const lastSubmittedValue = useRef<string | null>(null);
    const [internal, setInternal] = useState(value);

    const isChangePending = useMemo(
      () => value !== internal,
      [value, internal]
    );

    useEffect(() => {
      setInternal(value);
      if (lastSubmittedValue.current === null && value) {
        lastSubmittedValue.current = value;
      }
    }, [value]);

    useEffect(
      () => onChangePending?.(isChangePending),
      [onChangePending, isChangePending]
    );

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "f" && ev.metaKey) {
        ev.preventDefault();
        setExpandedInputIsOpen(true);
      } else if (onTab && ev.key === "Tab") {
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

    const [hasFocus, setHasFocus] = useState(false);
    const onBlur = () => {
      if (submitOnBlur && internal !== lastSubmittedValue.current) {
        onSubmit(internal);
      }
      setHasFocus(false);
    };

    const onFocus = (event: FocusEvent<HTMLInputElement>) => {
      if (selectAllOnFocus) {
        setTimeout(() => event.target.select(), 100);
      }
      setHasFocus(true);
    };

    const [expandedInputIsOpen, setExpandedInputIsOpen] = useState(false);
    const onApplyDetail = (newValue: string | object) => {
      const val =
        typeof newValue === "string" ? newValue : JSON.stringify(newValue);
      onSubmit(val);
      setExpandedInputIsOpen(false);
    };
    const onExpandInput = () => {
      setExpandedInputIsOpen(true);
    };

    const cls = `font-menu text-[0.87rem] ${
      showBackground
        ? "py-1 pl-2 bg-gray-100 rounded-lg"
        : "mr-2 bg-transparent"
    } ${className}`;
    return (
      <div
        className={`flex relative w-full items-center pr-2 ${
          showBackground ? "bg-gray-100 rounded-lg" : ""
        }`}
      >
        <Tooltip value={tooltip}>
          <Input
            id={id}
            ref={ref}
            className={cls}
            labelClassName={labelClassName}
            type={type}
            fullWidth={fullWidth}
            minHeight={minHeight}
            hideBottomBorder={hideBottomBorder}
            title={title}
            value={hasFocus ? internal : value}
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
        {isExpandable && (
          <div className={hasFocus ? "inline" : "hidden"}>
            <Button
              className="py-1 px-0 h-min"
              variant="ghost"
              onMouseDown={onExpandInput}
              tooltip={
                hasFocus ? "Expand to input area - or use Cmd + F" : undefined
              }
            >
              <Maximize size={14} />
            </Button>

            <EditorDialog
              title="Expanded Input View"
              value={value}
              isOpen={expandedInputIsOpen}
              onClose={() => setExpandedInputIsOpen(false)}
              actions={[{ label: "Apply", onAction: onApplyDetail }]}
              autofocus={true}
            />
          </div>
        )}
      </div>
    );
  }
);

export default SubmittableInput;
