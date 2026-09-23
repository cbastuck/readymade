import { usePressFeedback } from "./pressFeedback";
import { FacadeTab } from "./types";

/**
 * The row of names a facade's faces are chosen by.
 *
 * It is drawn inside the facade rather than in the toolbar, unlike the view-mode
 * controls: which tab is on screen is something a *board* declares and a person
 * uses, not a way of looking at the playground. A facade shown in a host with no
 * toolbar at all — the mobile board view, a deployed board — still has its tabs.
 */
export function FacadeTabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: FacadeTab[];
  active: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        gap: 2,
        flexShrink: 0,
        padding: "0 8px",
        borderBottom: "1px solid hsl(var(--border))",
        // More tabs than fit is a scroll rather than a second row: a bar that
        // changes height moves everything below it.
        overflowX: "auto",
        overflowY: "hidden",
      }}
    >
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          tab={tab}
          active={tab.id === active}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function Tab({
  tab,
  active,
  onSelect,
}: {
  tab: FacadeTab;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const press = usePressFeedback("neutral", false);
  return (
    <button
      {...press.handlers}
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(tab.id)}
      style={{
        appearance: "none",
        // Longhand throughout: the press feedback writes backgroundColor and
        // borderColor, and React warns when a shorthand covering either is set
        // alongside it.
        backgroundColor: "transparent",
        borderStyle: "solid",
        // The chosen tab is marked on the bar's own hairline, so choosing one
        // does not change what anything below it is sitting on.
        borderWidth: "0 0 2px 0",
        borderColor: active ? "var(--hkp-accent)" : "transparent",
        marginBottom: -1,
        padding: "9px 12px",
        cursor: "pointer",
        whiteSpace: "nowrap",
        fontFamily: "inherit",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        color: active
          ? "hsl(var(--foreground))"
          : "hsl(var(--muted-foreground))",
        ...press.style,
      }}
    >
      {tab.title}
    </button>
  );
}
