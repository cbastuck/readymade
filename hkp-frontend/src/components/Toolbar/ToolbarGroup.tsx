/**
 * A bordered group of icon buttons in the toolbar.
 *
 * Controls that answer one question — which half of the board is on screen,
 * what is shown in the board's place — are drawn inside one outline, so the
 * row reads as a few groups rather than as a line of unrelated icons.
 *
 * The buttons inside are smaller than a free-standing toolbar control
 * (TOOLBAR_GROUP_BUTTON), so that the outline around them comes out the height
 * of the controls beside it.
 */
import { CSSProperties, ReactNode } from "react";

/** The box of a button inside a group; what it is painted with is its own. */
export const TOOLBAR_GROUP_BUTTON: CSSProperties = {
  width: 26,
  height: 24,
  borderRadius: 7,
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

/** The size of an icon inside such a button. */
export const TOOLBAR_GROUP_ICON_SIZE = 14;

type Props = {
  /** What the group is, for anything that reads it rather than sees it. */
  label: string;
  children: ReactNode;
};

export default function ToolbarGroup({ label, children }: Props) {
  return (
    <div
      role="group"
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 2,
        borderRadius: 9,
        border: "1px solid var(--border-mid, #d1d5db)",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}
