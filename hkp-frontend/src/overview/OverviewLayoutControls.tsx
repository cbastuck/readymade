/**
 * How the overview lays the board out, floating over its top-right corner.
 *
 * Built like the board's view controls in the toolbar (FacadeViewControls) — a
 * group of icon buttons, the active one filled — but kept on the overview
 * rather than beside them, so the toolbar stays the same whichever way the
 * board is being looked at. Painted from the overview's palette, since it sits
 * on the scene rather than on the page.
 */
import { Columns3, Rows3 } from "lucide-react";

import { OverviewLayout } from "./graph";
import { useOverview } from "./OverviewContext";
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
  palette: Palette;
};

export default function OverviewLayoutControls({ palette }: Props) {
  const overview = useOverview();
  if (!overview) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label="Overview layout"
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 2,
        borderRadius: 9,
        background: palette.card,
        border: `1px solid ${palette.cardBorder}`,
        boxShadow: "0 2px 8px rgba(34, 38, 43, 0.10)",
      }}
    >
      {LAYOUTS.map(({ id, Icon, title, label }) => {
        const active = overview.layout === id;
        return (
          <button
            key={id}
            type="button"
            title={title}
            aria-label={label}
            aria-pressed={active}
            onClick={() => overview.setLayout(id)}
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
