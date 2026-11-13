import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from "react";

import PaneSplitter from "hkp-frontend/src/ui-components/PaneSplitter";

import { BindingSite, facadeBindings, widgetBindings } from "../bindings";
import { FacadeBindings } from "../FacadeBindingsBadge";
import { useFacadeBindings } from "../FacadeBindingsContext";
import {
  BindingList,
  OverlayTabs,
  WIDGET_TAB_TITLES,
  WidgetTab,
  bindingCounts,
} from "../panels/BindingRows";
import { FacadeStateView } from "../FacadeStateView";
import { FacadeDescriptor, FacadePanel, LayoutItem } from "../types";
import {
  EditorSelection,
  getAtPath,
  nodeLabel,
  pathOfSite,
  selectionKey,
  setAtPath,
  siteOfPath,
} from "./editorUtils";
import { WidgetTree } from "./WidgetTree";
import { PropertyPanel } from "./PropertyPanel";

/** Remembered heights of the editor's panes, in pixels. */
const TREE_HEIGHT_KEY = "hkp-facade-editor-tree-height";

/** Enough of a pane to be worth having; below this a drag stops. */
const MIN_PANE = 60;
/** What the selected element's pane keeps, whatever the others take. */
const MIN_DETAIL = 120;
/** Room the splitter itself takes. */
const SPLITTER = 7;

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

type DetailTab = "properties" | WidgetTab;

const DETAIL_TABS: DetailTab[] = ["properties", "sends", "shows"];

const DETAIL_TAB_TITLES: Record<DetailTab, string> = {
  properties: "Properties",
  ...WIDGET_TAB_TITLES,
};

type Props = {
  facade: FacadeDescriptor;
  onChange: (updated: FacadeDescriptor) => void;
};

/** What the facade holds besides its own settings, shown in their own items. */
const FACADE_PARTS = ["panels", "state", "init", "notices"];

/** One selected thing in the detail pane: its title, then what it is. */
function Detail({
  label,
  title,
  children,
}: {
  label: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={label}>
      <div className="hkp-editor-section-title">{title}</div>
      <div className="hkp-editor-card">{children}</div>
    </section>
  );
}

/**
 * Building a facade: everything it has as a tree — its panels and their
 * layouts, its state, and the actions and updates it runs by itself — and
 * whatever is selected there in the pane beside it.
 *
 * The bindings are the ones the badges show on the facade itself, drawn with
 * the same rows (`BindingRows`), so the editor and the facade say the same
 * thing about a widget. A state key's other widgets are selected here rather
 * than scrolled to, since the editor is where they are being looked at.
 */
export function FacadeEditor({ facade, onChange }: Props) {
  const [selected, setSelected] = useState<EditorSelection>({ kind: "panels" });
  // Kept as another node is selected: someone following what widgets send to
  // goes on looking at that as they move through the tree.
  const [detailTab, setDetailTab] = useState<DetailTab>("properties");
  const bindingsApi = useFacadeBindings();
  const index = useMemo(() => facadeBindings(facade), [facade]);
  const rootRef = useRef<HTMLDivElement>(null);
  const tree = usePaneHeight(TREE_HEIGHT_KEY);

  const paneHeight = (selector: string) =>
    rootRef.current?.querySelector(selector)?.getBoundingClientRect().height ??
    0;
  const rootHeight = () => rootRef.current?.clientHeight ?? 0;

  const path = selected.kind === "node" ? selected.path : [];
  const selectedNode = selected.kind === "node" ? getAtPath(facade, path) : null;
  const site = selectedNode ? siteOfPath(facade, path) : null;
  const bindings = selectedNode ? widgetBindings(selectedNode) : [];
  const counts = bindingCounts(bindings);

  // Where each service lives is read when something asks; a newly selected
  // item is that moment.
  const key = selectionKey(selected);
  useEffect(() => {
    bindingsApi?.refreshLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const selectSite = (other: BindingSite) => {
    const found = pathOfSite(facade, other);
    if (found) {
      setSelected({ kind: "node", path: found });
    }
  };

  const changePanel = (at: number, updated: FacadePanel) =>
    onChange({
      ...facade,
      panels: facade.panels.map((panel, i) => (i === at ? updated : panel)),
    });

  const detail = (() => {
    switch (selected.kind) {
      case "panels":
        return (
          <Detail label="Facade settings" title="Panels">
            <PropertyPanel<FacadeDescriptor>
              node={facade}
              omit={FACADE_PARTS}
              onChange={onChange}
            />
          </Detail>
        );
      case "panel": {
        const panel = facade.panels[selected.index];
        if (!panel) {
          return null;
        }
        return (
          <Detail label="Panel" title={`panel · ${panel.title ?? panel.id}`}>
            <PropertyPanel<FacadePanel>
              node={panel}
              omit={["layout"]}
              onChange={(updated) => changePanel(selected.index, updated)}
            />
          </Detail>
        );
      }
      case "state":
        return (
          <Detail label="Facade state" title="State">
            <FacadeStateView
              index={index}
              onReveal={selectSite}
              empty="Nothing in facade state yet."
            />
          </Detail>
        );
      case "actions":
        return (
          <Detail label="Actions and updates" title="Actions and Updates">
            <FacadeBindings
              tabs={["init", "notices"]}
              onDone={() => {}}
              onRevealSite={selectSite}
            />
          </Detail>
        );
      case "node":
        if (!selectedNode) {
          return null;
        }
        return (
          <Detail label="Selected element" title={nodeLabel(selectedNode)}>
            <div className="hkp-editor-tabs">
              <OverlayTabs
                tabs={DETAIL_TABS.map((id) => ({
                  id,
                  title: DETAIL_TAB_TITLES[id],
                  count: id === "properties" ? undefined : counts[id],
                }))}
                active={detailTab}
                onSelect={setDetailTab}
              />
            </div>
            {detailTab === "properties" || !site ? (
              <div role="tabpanel" aria-label="Properties">
                <PropertyPanel
                  node={selectedNode}
                  onChange={(updated: LayoutItem) =>
                    onChange(setAtPath(facade, path, updated))
                  }
                />
              </div>
            ) : (
              <BindingList
                bindings={bindings}
                role={detailTab}
                site={site}
                onDone={() => {}}
                onRevealSite={selectSite}
              />
            )}
          </Detail>
        );
    }
  })();

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
        <WidgetTree facade={facade} selected={selected} onSelect={setSelected} />
        <PaneSplitter
          className="hkp-editor-tree-splitter"
          label="Resize the layout tree"
          heightOf={() => tree.height ?? paneHeight(".hkp-editor-tree")}
          minHeight={MIN_PANE}
          maxHeight={() => rootHeight() - MIN_DETAIL - SPLITTER}
          onResize={tree.set}
          onCommit={tree.commit}
          onReset={tree.reset}
        />
        <div className="hkp-facade-editor-detail">{detail}</div>
      </div>
    </div>
  );
}
