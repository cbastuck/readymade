import { Fragment, useCallback, useRef } from "react";

import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadePanel } from "../types";
import { PanelRenderer } from "./PanelRenderer";
import { PanelSplitter, panelShare, usePanelWidths } from "./PanelSplitter";

/**
 * A set of panels shown side by side, with the dividers that share the width
 * between them.
 *
 * A row rather than the facade: with tabs a facade has several of these, each
 * with its own columns to divide, and the widths of one face say nothing about
 * the widths of another. `widthsKey` is what keeps those answers apart in
 * storage — the board's name alone for a facade with no tabs, so a board left at
 * a width before tabs existed opens at it still.
 *
 * A hidden row stays mounted. Switching tabs is a change of attention, not of
 * lifecycle: a table goes on collecting rows, a half-typed field is still
 * half-typed when it comes back, and a service that was subscribed to is still
 * subscribed to.
 */
export function PanelRow({
  panels,
  boardContext,
  widthsKey,
  hidden,
}: {
  panels: FacadePanel[];
  boardContext: BoardContextState;
  widthsKey: string;
  hidden?: boolean;
}) {
  const multiPanel = panels.length > 1;

  // Even columns are a guess — the panels hold different things, and which of
  // them deserves the room is the reader's to say, starting from whatever the
  // board itself asked for.
  const panelWidths = usePanelWidths(
    widthsKey,
    panels.length,
    panels.map((panel) => panelShare(panel.width)),
  );
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const panelPixels = useCallback(
    () => panelRefs.current.map((node) => node?.getBoundingClientRect().width ?? 0),
    [],
  );

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        display: hidden ? "none" : "flex",
        flexDirection: multiPanel ? "row" : "column",
      }}
    >
      {panels.map((panel, idx) => (
        <Fragment key={panel.id}>
          {/* The divider carries the line between two columns, so the panel
              itself no longer draws one. */}
          {multiPanel && idx > 0 && (
            <PanelSplitter
              index={idx - 1}
              widths={panelWidths}
              widthsOf={panelPixels}
              label={`${panels[idx - 1].title ?? "panel"} and ${panel.title ?? "panel"}`}
            />
          )}
          <div
            ref={(node) => {
              panelRefs.current[idx] = node;
            }}
            style={{
              // Weight rather than width: the columns keep their proportion
              // when the window changes size.
              flexGrow: panelWidths.weightOf(idx),
              flexShrink: 1,
              flexBasis: 0,
              // Without this a panel refuses to shrink past its content, and
              // the weights stop meaning anything.
              minWidth: 0,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <PanelRenderer
              panel={panel}
              boardContext={boardContext}
              showTitle={multiPanel}
            />
          </div>
        </Fragment>
      ))}
    </div>
  );
}
