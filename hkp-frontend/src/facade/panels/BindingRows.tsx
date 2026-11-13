import { ReactNode, useState } from "react";

import { useOverview } from "hkp-frontend/src/overview/OverviewContext";
import { useAssetView } from "hkp-frontend/src/assets/AssetViewContext";
import { useNestedNavigation } from "hkp-frontend/src/runtime/ui/NestedNavigation";
import { revealService } from "hkp-frontend/src/runtime/ui/revealService";
import type { FlowSide } from "hkp-frontend/src/ui-components/service/flowRecords";
import {
  Binding,
  BindingSite,
  ServiceBinding,
  StateBinding,
  isServiceBinding,
  siteKey,
} from "../bindings";
import { useFacadeBindings } from "../FacadeBindingsContext";
import { useFacadeView } from "../FacadeViewContext";
import { useFacadeState } from "../FacadeStateContext";
import { describeValue } from "../describeValue";
import { ServiceLocation, revealTargetOf } from "../serviceLocation";

/**
 * The rows a bindings overlay is made of — a widget's (BindingsBadge) and the
 * facade's own (FacadeBindingsBadge) — so the two say a binding the same way.
 */

/** What a binding does, as a row's first line says it. */
export function verbOf(binding: Binding): string {
  if (!isServiceBinding(binding)) {
    if (binding.access === "writes") {
      return "writes facade state";
    }
    // Read as an action runs and sent on, rather than shown.
    return binding.role === "sends" ? "uses facade state" : "reads facade state";
  }
  if (binding.role === "shows") {
    if (binding.surface) {
      return "shows its surface";
    }
    return binding.path ? `reads ${binding.path}` : "reads";
  }
  switch (binding.verb) {
    case "configure":
      return binding.keys.length > 0
        ? `configure ${binding.keys.join(", ")}`
        : "configure";
    case "process":
      return "process";
    case "send":
      return "sends the file";
    case "surface":
      return "captures into";
  }
}

/** What a site is called, for a list of the places a state key is used. */
export function siteLabel(site: BindingSite): string {
  if (site.kind === "init") {
    return "runs on open";
  }
  if (site.kind === "notice") {
    return `notice ${site.index + 1}`;
  }
  // A repeat's template is labelled with item references, which say what each
  // item shows rather than what anything is called: "{{item.title}}" reads as
  // "‹title›".
  const label = site.label?.replace(
    /\{\{item(?:\.([A-Za-z0-9_$.]+))?\}\}/g,
    (_match, path?: string) => `‹${path ?? "item"}›`,
  );
  const what = label
    ? `${label} (${site.type ?? "widget"})`
    : site.type ?? "widget";
  return site.path.includes("template") ? `${what}, per item` : what;
}

/** The tabs along an overlay's top. */
export function OverlayTabs<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  // A count is left out where the tab is not a list — an editor's Properties.
  tabs: { id: T; title: string; count?: number }[];
  active: T;
  onSelect: (tab: T) => void;
}) {
  return (
    <div className="hkp-binding-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onSelect(tab.id)}
        >
          {tab.title}
          {tab.count !== undefined && (
            <span className="hkp-binding-count">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function ServiceRow({
  binding,
  location,
  note,
  onDone,
}: {
  binding: ServiceBinding;
  location: ServiceLocation;
  // Said under the location — what a notice says when it fires, say.
  note?: ReactNode;
  onDone: () => void;
}) {
  const overview = useOverview();
  const assetView = useAssetView();
  const navigation = useNestedNavigation();
  const facadeView = useFacadeView();

  const target = revealTargetOf(location);
  const breadcrumb =
    location.status === "found" ||
    location.status === "unreachable" ||
    location.status === "inside-use"
      ? location.breadcrumb
      : [];
  const name =
    location.status === "found" || location.status === "unreachable"
      ? location.node.label
      : binding.service;

  const reveal = (inspect?: FlowSide) => {
    if (!target) {
      return;
    }
    // The board is what is revealed, so whatever covers it gives way — and
    // where only the facade is on screen, as it may be with the editor open,
    // the board comes on screen beside it.
    overview?.hide();
    assetView?.hide();
    if (facadeView && !facadeView.showRuntime) {
      facadeView.setMode("split");
    }
    revealService(target, navigation, { inspect });
    onDone();
  };

  // An "Acts on" binding is the service's input; an "Updated by" its output.
  const side: FlowSide = binding.role === "sends" ? "input" : "output";

  return (
    <li className="hkp-binding-row">
      <div className="hkp-binding-verb">{verbOf(binding)}</div>
      <div className="hkp-binding-name">{name}</div>
      {breadcrumb.length > 0 && (
        <div className="hkp-binding-crumbs">
          {breadcrumb.map((crumb) => crumb.label).join(" › ")}
        </div>
      )}
      <LocationNote location={location} />
      {note && <div className="hkp-binding-note">{note}</div>}
      {target && (
        <div className="hkp-binding-actions">
          <button type="button" onClick={() => reveal()}>
            Show in board
          </button>
          <button
            type="button"
            disabled={location.status === "unreachable"}
            title={
              location.status === "unreachable"
                ? "Its runtime is not attached, so there is nothing to inspect"
                : undefined
            }
            onClick={() => reveal(side)}
          >
            Inspect
          </button>
        </div>
      )}
    </li>
  );
}

function LocationNote({ location }: { location: ServiceLocation }) {
  switch (location.status) {
    case "pending":
      return <div className="hkp-binding-note">Looking for it on the board…</div>;
    case "missing":
      return (
        <div className="hkp-binding-note hkp-binding-note--error">
          No service “{location.address}” on this board.
        </div>
      );
    case "unreachable":
      return (
        <div className="hkp-binding-note hkp-binding-note--warn">
          Its runtime is not attached.
        </div>
      );
    case "inside-use":
      return (
        <div className="hkp-binding-note">
          Inside a use of block “{location.block}”, which is shown as a whole.
        </div>
      );
    case "found":
      return null;
  }
}

/**
 * Places a state key is used, each a link to its widget where it is one.
 * `title` leads the list; `empty` stands in for it when there are none.
 */
export function SiteLinks({
  title,
  sites,
  empty,
  onReveal,
}: {
  title: string;
  sites: BindingSite[];
  empty: ReactNode;
  // Absent, the sites are named but are not links.
  onReveal?: (site: BindingSite) => void;
}) {
  if (sites.length === 0) {
    return <div className="hkp-binding-note">{empty}</div>;
  }
  return (
    <div className="hkp-binding-note">
      {title}{" "}
      {sites.map((site, i) => (
        <span key={siteKey(site)}>
          {i > 0 && " · "}
          {site.kind === "widget" && onReveal ? (
            <button
              type="button"
              className="hkp-binding-link"
              onClick={() => onReveal(site)}
            >
              {siteLabel(site)}
            </button>
          ) : (
            siteLabel(site)
          )}
        </span>
      ))}
    </div>
  );
}

/** A state key one widget writes or reads, pointing at the others that do. */
export function StateRow({
  binding,
  own,
  onReveal,
}: {
  binding: StateBinding;
  own: BindingSite;
  onReveal: (site: BindingSite) => void;
}) {
  const api = useFacadeBindings();
  const { state: values } = useFacadeState();
  const entry = api?.index.state[binding.state];
  // A key written here is read elsewhere, and the other way round.
  const writes = binding.access === "writes";
  const others = ((writes ? entry?.readers : entry?.writers) ?? []).filter(
    (site) => siteKey(site) !== siteKey(own),
  );

  return (
    <li className="hkp-binding-row">
      <div className="hkp-binding-verb">{verbOf(binding)}</div>
      <div className="hkp-binding-name">“{binding.state}”</div>
      {/* What it holds now, so state stays in view beside a widget's own. */}
      <div className="hkp-binding-value">{describeValue(values[binding.state])}</div>
      {!writes && entry?.seeded && (
        <div className="hkp-binding-note">
          Starts with the facade's initial state.
        </div>
      )}
      <SiteLinks
        title={writes ? "Read by" : "Written by"}
        sites={others}
        empty={
          writes ? (
            "No other widget reads it."
          ) : entry?.seeded ? (
            "No widget writes it."
          ) : (
            <span className="hkp-binding-note--warn">Nothing writes it.</span>
          )
        }
        onReveal={onReveal}
      />
    </li>
  );
}

export type WidgetTab = "sends" | "shows";

export const WIDGET_TAB_TITLES: Record<WidgetTab, string> = {
  sends: "Acts on",
  shows: "Updated by",
};

/**
 * One side of a widget's bindings — what it sends to, or what it shows from —
 * as a list. Under the badge overlay's tabs, and under the facade editor's.
 */
export function BindingList({
  bindings,
  role,
  site,
  onDone,
  onRevealSite,
}: {
  bindings: Binding[];
  role: WidgetTab;
  site: BindingSite;
  // Called once a row has taken the person somewhere else.
  onDone: () => void;
  // How another widget is brought into view, from a state binding's links.
  onRevealSite: (site: BindingSite) => void;
}) {
  const api = useFacadeBindings();
  const shown = bindings.filter((b) => b.role === role);
  return (
    <ul
      className="hkp-binding-list"
      role="tabpanel"
      aria-label={WIDGET_TAB_TITLES[role]}
    >
      {shown.length === 0 && (
        <li className="hkp-binding-empty">
          {role === "sends" ? "Acts on nothing." : "Updated by nothing."}
        </li>
      )}
      {api &&
        shown.map((binding, i) =>
          isServiceBinding(binding) ? (
            <ServiceRow
              key={i}
              binding={binding}
              location={api.locate(binding.service)}
              onDone={onDone}
            />
          ) : (
            <StateRow key={i} binding={binding} own={site} onReveal={onRevealSite} />
          ),
        )}
    </ul>
  );
}

/** How many of a widget's bindings go each way. */
export function bindingCounts(bindings: Binding[]): Record<WidgetTab, number> {
  return {
    sends: bindings.filter((b) => b.role === "sends").length,
    shows: bindings.filter((b) => b.role === "shows").length,
  };
}

/**
 * What one widget acts on and is updated by, under two tabs — the widget badge's
 * overlay.
 */
export function WidgetBindings({
  bindings,
  site,
  onDone,
  onRevealSite,
}: {
  bindings: Binding[];
  site: BindingSite;
  // Called once a row has taken the person somewhere else.
  onDone: () => void;
  // How another widget is brought into view, from a state binding's links.
  onRevealSite: (site: BindingSite) => void;
}) {
  const counts = bindingCounts(bindings);
  const [chosen, setTab] = useState<WidgetTab | null>(null);
  // Until one is chosen, the tab that has something in it.
  const tab =
    chosen ?? (counts.sends > 0 || counts.shows === 0 ? "sends" : "shows");

  return (
    <>
      <OverlayTabs
        tabs={(["sends", "shows"] as const).map((id) => ({
          id,
          title: WIDGET_TAB_TITLES[id],
          count: counts[id],
        }))}
        active={tab}
        onSelect={setTab}
      />
      <BindingList
        bindings={bindings}
        role={tab}
        site={site}
        onDone={onDone}
        onRevealSite={onRevealSite}
      />
    </>
  );
}
