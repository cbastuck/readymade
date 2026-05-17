import {
  FocusEvent,
  KeyboardEvent,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ChevronDown } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "hkp-frontend/src/ui-components/primitives/popover";
import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";
import { ThemeCtx } from "hkp-frontend/src/ui-components/ThemeContext";

type Props = {
  title?: string;
  value: string;
  options: string[];
  placeholder?: string;
  onOpen?: () => void;
  onSubmit: (value: string) => void;
};

export default function ComboInput({
  title,
  value,
  options,
  placeholder,
  onOpen,
  onSubmit,
}: Props) {
  const [internal, setInternal] = useState(value);
  const [hasFocus, setHasFocus] = useState(false);
  const [open, setOpen] = useState(false);
  const lastSubmitted = useRef<string | null>(null);
  const theme = useContext(ThemeCtx);

  useEffect(() => {
    setInternal(value);
    if (lastSubmitted.current === null && value) {
      lastSubmitted.current = value;
    }
  }, [value]);

  const submit = (val: string) => {
    lastSubmitted.current = val;
    onSubmit(val);
  };

  const onKeyUp = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "Enter") {
      submit(internal);
    }
  };

  const onFocus = () => setHasFocus(true);

  const onBlur = (_ev: FocusEvent<HTMLInputElement>) => {
    setHasFocus(false);
    if (internal !== lastSubmitted.current) {
      submit(internal);
    }
  };

  const onSelect = (option: string) => {
    setInternal(option);
    submit(option);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2 w-full mr-2">
      {title && (
        <GroupLabel size={4} className="pt-0 whitespace-nowrap">
          {title}
        </GroupLabel>
      )}
      <div
        className="flex flex-1 items-center border-b min-w-0"
        style={{ borderColor: theme.borderColor }}
      >
        <input
          className="flex-1 min-w-0 bg-transparent font-menu text-[0.87rem] h-min pl-1 outline-none text-ellipsis"
          value={hasFocus ? internal : value}
          spellCheck={false}
          placeholder={placeholder}
          onChange={(e) => setInternal(e.target.value)}
          onKeyUp={onKeyUp}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        <Popover
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (nextOpen) {
              onOpen?.();
            }
          }}
        >
          <PopoverTrigger asChild>
            <button
              className="flex items-center px-1 opacity-40 hover:opacity-80 transition-opacity"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
            >
              <ChevronDown size={12} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-56 p-1 font-menu"
            style={
              theme.popoverBackgroundColor
                ? { backgroundColor: theme.popoverBackgroundColor }
                : undefined
            }
          >
            {options.length === 0 ? (
              <div className="text-sm px-2 py-1 opacity-50">No peers found</div>
            ) : (
              <div className="max-h-48 overflow-y-auto flex flex-col">
                {options.map((opt) => (
                  <button
                    key={opt}
                    className="text-left px-2 py-1 text-sm hover:bg-accent rounded truncate"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onSelect(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
