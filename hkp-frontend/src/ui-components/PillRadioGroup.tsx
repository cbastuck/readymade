import { KeyboardEvent, useRef } from "react";

import GroupLabel from "./GroupLabel";

type Props = {
  title?: string;
  /** Values, or a value → label map where the two differ. */
  options: Array<string> | { [value: string]: string };
  value: string;
  onChange: (value: string) => void;
};

/** What each key moves the selection by, the rest leaving it alone. */
const ARROW_STEPS: { [key: string]: number } = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

export default function PillRadioGroup({
  title,
  options,
  value,
  onChange,
}: Props) {
  const values = Array.isArray(options) ? options : Object.keys(options);
  const labels = Array.isArray(options)
    ? options
    : values.map((val) => options[val]);
  const pills = useRef<Array<HTMLButtonElement | null>>([]);

  // The pills read as a radio group, so they behave as one: the group is a
  // single tab stop landing on what is checked, and the arrows move from there.
  const checkedIdx = Math.max(values.indexOf(value), 0);
  const onKeyDown = (ev: KeyboardEvent, idx: number) => {
    const step = ARROW_STEPS[ev.key];
    if (!step) {
      return;
    }
    ev.preventDefault();
    const next = (idx + step + values.length) % values.length;
    onChange(values[next]);
    pills.current[next]?.focus();
  };

  return (
    <div>
      {title && (
        <GroupLabel className="hkp-svc-field-label pb-1" size={4}>
          {title}
        </GroupLabel>
      )}
      <div
        role="radiogroup"
        aria-label={title}
        style={{ display: "flex", gap: 5 }}
      >
        {values.map((opt, idx) => (
          <button
            key={opt}
            ref={(el) => {
              pills.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={opt === value}
            tabIndex={idx === checkedIdx ? 0 : -1}
            className={`hkp-rpill${opt === value ? " sel" : ""} capitalize`}
            onClick={() => onChange(opt)}
            onKeyDown={(ev) => onKeyDown(ev, idx)}
          >
            {labels[idx]}
          </button>
        ))}
      </div>
    </div>
  );
}
