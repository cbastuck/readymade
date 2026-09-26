/**
 * How the overview lays the board out, in its bar.
 *
 * Built like the board's own view controls in the toolbar (FacadeViewControls)
 * — a group of icon buttons, the active one filled — but painted from the
 * overview's palette, since the bar it sits in is painted from it too.
 */
import { Columns3, Rows3 } from "lucide-react";

import { OverviewLayout } from "./graph";
import { Palette } from "./render";

const LAYOUTS: Array<{
  id: OverviewLayout;
  Icon: typeof Columns3;
  title: string;
  label: string;
}> = [
  {
    id: "lanes",
    Icon: Columns3,
    title:
      "Side by side — pipelines on one nesting level stand next to each other",
    label: "Lay nested pipelines side by side",
  },
  {
    id: "stacked",
    Icon: Rows3,
    title: "Stacked — one column per runtime, nested pipelines below their host",
    label: "Stack nested pipelines below their host",
  },
];

type Props = {
  layout: OverviewLayout;
  onChange: (layout: OverviewLayout) => void;
  palette: Palette;
};

export default function OverviewLayoutControls({
  layout,
  onChange,
  palette,
}: Props) {
  return (
    <div
      role="group"
      aria-label="Overview layout"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 2,
        borderRadius: 9,
        border: `1px solid ${palette.cardBorder}`,
        flexShrink: 0,
      }}
    >
      {LAYOUTS.map(({ id, Icon, title, label }) => {
        const active = layout === id;
        return (
          <button
            key={id}
            type="button"
            title={title}
            aria-label={label}
            aria-pressed={active}
            onClick={() => onChange(id)}
            style={{
              width: 26,
              height: 24,
              borderRadius: 7,
              border: "none",
              background: active ? palette.accent : "none",
              color: active ? "#fff" : palette.text,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={14} strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}
