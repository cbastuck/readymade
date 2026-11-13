import { CSSProperties, useEffect, useRef, useState } from "react";

import PaneSplitter from "hkp-frontend/src/ui-components/PaneSplitter";

import { BindingSite, widgetBindings } from "../bindings";
import { FacadeBindings } from "../FacadeBindingsBadge";
import { useFacadeBindings } from "../FacadeBindingsContext";
import { WidgetBindings } from "../panels/BindingRows";
import { FacadeDescriptor, LayoutItem } from "../types";
import {
  EditorPath,
  getAtPath,
  pathOfSite,
  setAtPath,
  siteOfPath,
} from "./editorUtils";
import { WidgetTree } from "./WidgetTree";
import { PropertyPanel } from "./PropertyPanel";
import { StatePanel } from "./StatePanel";

/** Remembered heights of the editor's panes, in pixels. */
const TREE_HEIGHT_KEY = "hkp-facade-editor-tree-height";
const STATE_HEIGHT_KEY = "hkp-facade-editor-state-height";

/** Enough of a pane to be worth having; below this a drag stops. */
const MIN_PANE = 60;
/** What the selected element's pane keeps, whatever the others take. */
const MIN_DETAIL = 120;
/** Room the splitters themselves take. */
const SPLITTERS = 14;

function storedHeight(key: string): number | null {
  try {
    const stored = parseInt(localStorage.getItem(key) ?? "", 10);
    return stored > 0 ? stored : null;
  } catch {
    return null;
  }
}

function storeHeight(key: string, height: number | null) {
  try {
    if (height === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, String(Math.round(height)));
    }
  } catch {
    // Not remembered; the pane still has the height for this session.
  }
}

/**
 * A pane's height, as dragged and remembered. Unset, the pane sizes itself.
 * Only a finished drag is remembered: the pane follows the pointer, the stored
 * height is where it was let go.
 */
function usePaneHeight(key: string) {
  const [height, setHeight] = useState<number | null>(() => storedHeight(key));
  const latest = useRef(height);
  latest.current = height;
  return {
    height,
    set: setHeight,
    commit: () => storeHeight(key, latest.current),
    reset: () => {
      storeHeight(key, null);
      setHeight(null);
    },
  };
}

type Props = {
  facade: FacadeDescriptor;
  onChange: (updated: FacadeDescriptor) => void;
};

/**
 * Building a facade: its layout as a tree, the selected node's properties and
 * bindings beside it, and its state below.
 *
 * The bindings are the ones the badges show on the facade itself, drawn with
 * the same rows (`BindingRows`), so the editor and the facade say the same
 * thing about a widget. A state key's other widgets are selected here rather
 * than scrolled to, since the editor is where they are being looked at.
 */
export function FacadeEditor({ facade, onChange }: Props) {
  const [selectedPath, setSelectedPath] = useState<EditorPath>([]);
  const bindingsApi = useFacadeBindings();
  const rootRef = useRef<HTMLDivElement>(null);
  const tree = usePaneHeight(TREE_HEIGHT_KEY);
  const state = usePaneHeight(STATE_HEIGHT_KEY);

  const paneHeight = (selector: string) =>
    rootRef.current?.querySelector(selector)?.getBoundingClientRect().height ??
    0;
  const rootHeight = () => rootRef.current?.clientHeight ?? 0;
  // The tree takes height only while it is stacked over the details, which a
  // narrow editor does (see index.css).
  const treeStacked = () => {
    const main = rootRef.current?.querySelector(".hkp-facade-editor-main");
    return !!main && getComputedStyle(main).flexDirection === "column";
  };

  const selectedNode = getAtPath(facade, selectedPath);
  const site = siteOfPath(facade, selectedPath);
  const bindings = selectedNode ? widgetBindings(selectedNode) : [];

  // Where each service lives is read when something asks; a newly selected
  // node is that moment.
  const selectionKey = selectedPath.join(".");
  useEffect(() => {
    bindingsApi?.refreshLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  const handleNodeChange = (updated: LayoutItem) => {
    onChange(setAtPath(facade, selectedPath, updated));
  };

  const selectSite = (other: BindingSite) => {
    const path = pathOfSite(facade, other);
    if (path) {
      setSelectedPath(path);
    }
  };

  return (
    <div
      ref={rootRef}
      className="hkp-facade-editor"
      style={
        tree.height !== null
          ? ({ "--hkp-editor-tree-height": `${tree.height}px` } as CSSProperties)
          : undefined
      }
    >
      <div className="hkp-facade-editor-main">
        <WidgetTree
          facade={facade}
          selectedPath={selectedPath}
          onSelect={setSelectedPath}
        />
        <PaneSplitter
          className="hkp-editor-tree-splitter"
          label="Resize the layout tree"
          heightOf={() => tree.height ?? paneHeight(".hkp-editor-tree")}
          minHeight={MIN_PANE}
          maxHeight={() =>
            rootHeight() - paneHeight(".hkp-editor-state") - MIN_DETAIL - SPLITTERS
          }
          onResize={tree.set}
          onCommit={tree.commit}
          onReset={tree.reset}
        />
        <div className="hkp-facade-editor-detail">
          {selectedPath.length === 0 || !selectedNode ? (
            <section aria-label="Facade bindings">
              <div className="hkp-editor-section-title">Facade</div>
              <div className="hkp-editor-card">
                <FacadeBindings
                  tabs={["init", "notices"]}
                  onDone={() => {}}
                  onRevealSite={selectSite}
                />
              </div>
            </section>
          ) : (
            <>
              <PropertyPanel node={selectedNode} onChange={handleNodeChange} />
              {site && (bindings.length > 0 || !("items" in selectedNode)) && (
                <section aria-label="Bindings" className="hkp-editor-section">
                  <div className="hkp-editor-section-title">Bindings</div>
                  <div className="hkp-editor-card">
                    <WidgetBindings
                      // A different node starts on its own first tab.
                      key={selectionKey}
                      bindings={bindings}
                      site={site}
                      onDone={() => {}}
                      onRevealSite={selectSite}
                    />
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
      <PaneSplitter
        label="Resize the facade state"
        resizes="below"
        heightOf={() => state.height ?? paneHeight(".hkp-editor-state")}
        minHeight={MIN_PANE}
        maxHeight={() =>
          rootHeight() -
          (treeStacked() ? paneHeight(".hkp-editor-tree") : 0) -
          MIN_DETAIL -
          SPLITTERS
        }
        onResize={state.set}
        onCommit={state.commit}
        onReset={state.reset}
      />
      <StatePanel
        facade={facade}
        onRevealSite={selectSite}
        height={state.height}
      />
    </div>
  );
}
