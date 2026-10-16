import { useMemo, useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "hkp-frontend/src/ui-components/primitives/popover";

/**
 * A date, or a date and a time, picked from a month rather than typed.
 *
 * The browser's own pickers differ from one webview to the next — some draw a
 * calendar, some only segmented fields, some nothing at all for a date with a
 * time — and a facade is shown in all of them. This one looks the same
 * everywhere and needs nothing but the popover the app already has.
 *
 * Its value is the one the browser's `date` and `datetime-local` inputs use —
 * `2026-09-24`, `2026-09-24T14:00`, in local time — so a board reads it the
 * same whichever drew it.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Minutes offered: every five, which is what a meeting is set to. */
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
/** A day picked before any time was: late morning, easy to move from. */
const DEFAULT_TIME = { hour: 10, minute: 0 };

type Picked = {
  year: number;
  /** 0–11, as `Date` counts them. */
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function parse(value: string): Picked | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value);
  if (!match) {
    return null;
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
    hour: match[4] !== undefined ? Number(match[4]) : DEFAULT_TIME.hour,
    minute: match[5] !== undefined ? Number(match[5]) : DEFAULT_TIME.minute,
  };
}

export function formatPicked(picked: Picked, withTime: boolean): string {
  const date = `${picked.year}-${pad(picked.month + 1)}-${pad(picked.day)}`;
  return withTime ? `${date}T${pad(picked.hour)}:${pad(picked.minute)}` : date;
}

/** The days of a month laid out in weeks from Monday, blank where it has none. */
function weeksOf(year: number, month: number): Array<Array<number | null>> {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7) {
    cells.push(null);
  }
  const weeks: Array<Array<number | null>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

const fieldStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--muted))",
  color: "hsl(var(--foreground))",
  fontSize: 13,
  textAlign: "left",
  cursor: "pointer",
};

const selectStyle: React.CSSProperties = {
  padding: "4px 6px",
  borderRadius: 6,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--muted))",
  color: "hsl(var(--foreground))",
  fontSize: 13,
};

export function DateTimePicker({
  value,
  onChange,
  withTime,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  withTime: boolean;
  placeholder?: string;
}) {
  const picked = parse(value);
  const [open, setOpen] = useState(false);
  // The month on show: the picked one, else this one.
  const [shown, setShown] = useState(() => {
    const start = picked ?? {
      year: new Date().getFullYear(),
      month: new Date().getMonth(),
    };
    return { year: start.year, month: start.month };
  });

  const weekdays = useMemo(() => {
    const format = new Intl.DateTimeFormat(undefined, { weekday: "short" });
    // 2024-01-01 was a Monday.
    return Array.from({ length: 7 }, (_, i) =>
      format.format(new Date(2024, 0, 1 + i)),
    );
  }, []);
  const monthTitle = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(new Date(shown.year, shown.month, 1));

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() &&
    shown.month === today.getMonth() &&
    shown.year === today.getFullYear();
  const isPicked = (day: number) =>
    !!picked &&
    day === picked.day &&
    shown.month === picked.month &&
    shown.year === picked.year;

  const turn = (by: number) =>
    setShown(({ year, month }) => {
      const next = new Date(year, month + by, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  const pickDay = (day: number) => {
    onChange(
      formatPicked(
        {
          year: shown.year,
          month: shown.month,
          day,
          hour: picked?.hour ?? DEFAULT_TIME.hour,
          minute: picked?.minute ?? DEFAULT_TIME.minute,
        },
        withTime,
      ),
    );
    // A day is the whole answer without a time; with one, the time is next.
    if (!withTime) {
      setOpen(false);
    }
  };

  const pickTime = (hour: number, minute: number) => {
    if (picked) {
      onChange(formatPicked({ ...picked, hour, minute }, true));
    }
  };

  const label = picked
    ? new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
      }).format(
        new Date(
          picked.year,
          picked.month,
          picked.day,
          picked.hour,
          picked.minute,
        ),
      )
    : (placeholder ?? (withTime ? "Pick a date and time" : "Pick a date"));

  // Offered even where the value holds a minute off the five-minute steps, so
  // what is picked is always what is shown.
  const minutes =
    picked && !MINUTES.includes(picked.minute)
      ? [...MINUTES, picked.minute].sort((a, b) => a - b)
      : MINUTES;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          style={{
            ...fieldStyle,
            color: picked
              ? "hsl(var(--foreground))"
              : "hsl(var(--muted-foreground))",
          }}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => turn(-1)}
              style={{ ...selectStyle, cursor: "pointer" }}
            >
              ‹
            </button>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{monthTitle}</span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => turn(1)}
              style={{ ...selectStyle, cursor: "pointer" }}
            >
              ›
            </button>
          </div>
          <div
            role="grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 32px)",
              gap: 2,
              fontSize: 12,
            }}
          >
            {weekdays.map((name) => (
              <span
                key={name}
                style={{
                  textAlign: "center",
                  color: "hsl(var(--muted-foreground))",
                  paddingBottom: 2,
                }}
              >
                {name}
              </span>
            ))}
            {weeksOf(shown.year, shown.month)
              .flat()
              .map((day, i) =>
                day === null ? (
                  <span key={`blank-${i}`} />
                ) : (
                  <button
                    key={day}
                    type="button"
                    aria-label={`${shown.year}-${pad(shown.month + 1)}-${pad(day)}`}
                    aria-pressed={isPicked(day)}
                    onClick={() => pickDay(day)}
                    style={{
                      height: 32,
                      borderRadius: 6,
                      border: isToday(day)
                        ? "1px solid hsl(var(--primary))"
                        : "1px solid transparent",
                      background: isPicked(day)
                        ? "hsl(var(--primary))"
                        : "transparent",
                      color: isPicked(day)
                        ? "hsl(var(--primary-foreground))"
                        : "hsl(var(--foreground))",
                      cursor: "pointer",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {day}
                  </button>
                ),
              )}
          </div>
          {withTime && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
              }}
            >
              <span style={{ color: "hsl(var(--muted-foreground))" }}>at</span>
              <select
                aria-label="Hour"
                disabled={!picked}
                value={picked?.hour ?? DEFAULT_TIME.hour}
                onChange={(e) =>
                  pickTime(Number(e.target.value), picked?.minute ?? 0)
                }
                style={selectStyle}
              >
                {HOURS.map((hour) => (
                  <option key={hour} value={hour}>
                    {pad(hour)}
                  </option>
                ))}
              </select>
              <span>:</span>
              <select
                aria-label="Minute"
                disabled={!picked}
                value={picked?.minute ?? DEFAULT_TIME.minute}
                onChange={(e) =>
                  pickTime(picked?.hour ?? 0, Number(e.target.value))
                }
                style={selectStyle}
              >
                {minutes.map((minute) => (
                  <option key={minute} value={minute}>
                    {pad(minute)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  marginLeft: "auto",
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
