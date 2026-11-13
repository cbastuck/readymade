import { RefObject, useLayoutEffect, useRef, useState } from "react";
import { Link2 } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "hkp-frontend/src/ui-components/primitives/popover";
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
import { ServiceLocation, revealTargetOf } from "../serviceLocation";

/**
 * The corner badge on a facade widget, and the overlay it opens: what the
 * widget sends to and what it shows from, each binding resolvable to where it
 * lives on the board.
 *
 * Positioned over the widget rather than beside it, so the facade's layout is
 * the same with and without badges; faint until the widget is hovered or
 * focused, and always shown on a screen with no hover (see index.css). Only the
 * badge itself takes clicks, so a canvas or a pad under it keeps working.
 */

type Tab = "sends" | "shows";

const TAB_TITLES: Record<Tab, string> = {
  sends: "Sends to",
  shows: "Shows from",
};

/** What a binding does, as the overlay's first line says it. */
export function verbOf(binding: Binding): string {
  if (!isServiceBinding(binding)) {
    return binding.role === "sends" ? "writes facade state" : "reads facade state";
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
function siteLabel(site: BindingSite): string {
  if (site.kind === "init") {
    return "runs on open";
  }
  if (site.kind === "notice") {
    return `notice ${site.index + 1}`;
  }
  const what = site.label ? `${site.label} (${site.type ?? "widget"})` : site.type ?? "widget";
  return site.path.includes("template") ? `${what}, per item` : what;
}

const BADGE_SIZE = 18;
/** Elements measured by their own box, whatever is inside them. */
const CONTROL_TAGS = /^(BUTTON|INPUT|TEXTAREA|SELECT|CANVAS|SVG|VIDEO|IMG)$/i;
/** Past this many elements a widget is measured by its wrapper instead. */
const MEASURE_LIMIT = 400;

function textRect(element: Element): DOMRect {
  const range = document.createRange();
  range.selectNodeContents(element);
  const rect = range.getBoundingClientRect?.();
  return rect && rect.width > 0 ? rect : element.getBoundingClientRect();
}

/**
 * Where the widget's visible content ends, relative to the wrapper the badge
 * is placed against.
 *
 * A widget's wrapper stretches across its column, so its corner is usually
 * far from anything drawn — a button sits at the left of a row the width of
 * the panel. The corner is taken instead from the extent of what the widget
 * draws: the elements with nothing inside them, and the controls. Measured
 * rather than laid out differently, so the facade looks the same with and
 * without badges.
 */
function useContentCorner(
  badgeRef: RefObject<HTMLButtonElement | null>,
): { top: number; left: number } | null {
  const [corner, setCorner] = useState<{ top: number; left: number } | null>(
    null,
  );
  useLayoutEffect(() => {
    const badge = badgeRef.current;
    const host = badge?.parentElement;
    if (!badge || !host) {
      return;
    }
    const measure = () => {
      const hostRect = host.getBoundingClientRect();
      let right = -Infinity;
      let top = Infinity;
      const all = host.querySelectorAll("*");
      if (all.length <= MEASURE_LIMIT) {
        all.forEach((element) => {
          if (badge === element || badge.contains(element)) {
            return;
          }
          const control = CONTROL_TAGS.test(element.tagName);
          const drawn = control || element.childElementCount === 0;
          if (!drawn) {
            return;
          }
          // Text is measured as text: a line of it usually sits in a block
          // as wide as the column. A control is measured by its own box,
          // padding and all — a button's label sits inside its face.
          const rect =
            !control && element.childElementCount === 0 && element.textContent
              ? textRect(element)
              : element.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) {
            return;
          }
          right = Math.max(right, rect.right);
          top = Math.min(top, rect.top);
        });
      }
      if (!Number.isFinite(right)) {
        right = hostRect.right;
        top = hostRect.top;
      }
      // Centred on the content's top-right corner: only its bottom-left
      // quarter lies over the widget, so it reads as the widget's own without
      // covering anything worth pressing — a button's face least of all.
      let nextTop = top - hostRect.top - BADGE_SIZE / 2;
      let nextLeft = right - hostRect.left - BADGE_SIZE / 2;
      // A wrapper that clips its content would clip the badge too, so there it
      // is kept inside.
      if (getComputedStyle(host).overflow === "hidden") {
        nextTop = Math.max(0, nextTop);
        nextLeft = Math.min(nextLeft, hostRect.width - BADGE_SIZE);
      }
      const next = { top: nextTop, left: Math.max(0, nextLeft) };
      setCorner((prev) =>
        prev && prev.top === next.top && prev.left === next.left ? prev : next,
      );
    };
    measure();
    // A web font arriving late changes how wide text is without resizing
    // anything observed below; hovering is when the badge is looked at.
    let live = true;
    document.fonts?.ready.then(() => live && measure());
    host.addEventListener("pointerenter", measure);
    if (typeof ResizeObserver === "undefined") {
      return () => {
        live = false;
        host.removeEventListener("pointerenter", measure);
      };
    }
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(host);
    Array.from(host.children).forEach((child) => {
      if (child !== badge) {
        observer.observe(child);
      }
    });
    return () => {
      live = false;
      host.removeEventListener("pointerenter", measure);
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [badgeRef]);
  return corner;
}

export function BindingsBadge({
  bindings,
  site,
}: {
  bindings: Binding[];
  site: BindingSite;
}) {
  const api = useFacadeBindings();
  const [open, setOpen] = useState(false);
  const badgeRef = useRef<HTMLButtonElement>(null);
  const corner = useContentCorner(badgeRef);
  const sends = bindings.filter((b) => b.role === "sends");
  const shows = bindings.filter((b) => b.role === "shows");
  const [tab, setTab] = useState<Tab>(sends.length > 0 ? "sends" : "shows");

  if (!api) {
    return null;
  }

  const onOpenChange = (next: boolean) => {
    if (next) {
      api.refreshLocations();
    }
    setOpen(next);
  };

  const shown = tab === "sends" ? sends : shows;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          ref={badgeRef}
          type="button"
          className="hkp-binding-badge"
          style={corner ? { top: corner.top, left: corner.left, right: "auto" } : undefined}
          aria-label="What this sends to and shows from"
          title="What this sends to and shows from"
        >
          <Link2 size={11} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="hkp-binding-overlay"
        align="end"
        style={{ width: "min(360px, 92vw)", padding: 0 }}
      >
        <div className="hkp-binding-tabs" role="tablist">
          {(["sends", "shows"] as const).map((each) => (
            <button
              key={each}
              type="button"
              role="tab"
              aria-selected={tab === each}
              onClick={() => setTab(each)}
            >
              {TAB_TITLES[each]}
              <span className="hkp-binding-count">
                {(each === "sends" ? sends : shows).length}
              </span>
            </button>
          ))}
        </div>
        <ul className="hkp-binding-list" role="tabpanel" aria-label={TAB_TITLES[tab]}>
          {shown.length === 0 && (
            <li className="hkp-binding-empty">
              {tab === "sends" ? "Sends to nothing." : "Shows from nothing."}
            </li>
          )}
          {shown.map((binding, i) =>
            isServiceBinding(binding) ? (
              <ServiceRow
                key={i}
                binding={binding}
                location={api.locate(binding.service)}
                onDone={() => setOpen(false)}
              />
            ) : (
              <StateRow
                key={i}
                binding={binding}
                own={site}
                onReveal={(other) => {
                  setOpen(false);
                  api.revealWidget(other);
                }}
              />
            ),
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function ServiceRow({
  binding,
  location,
  onDone,
}: {
  binding: ServiceBinding;
  location: ServiceLocation;
  onDone: () => void;
}) {
  const overview = useOverview();
  const assetView = useAssetView();
  const navigation = useNestedNavigation();

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
    // The board is what is revealed, so whatever covers it gives way.
    overview?.hide();
    assetView?.hide();
    revealService(target, navigation, { inspect });
    onDone();
  };

  // A "Sends to" binding is the service's input; a "Shows from" its output.
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

function StateRow({
  binding,
  own,
  onReveal,
}: {
  binding: StateBinding;
  own: BindingSite;
  onReveal: (site: BindingSite) => void;
}) {
  const api = useFacadeBindings();
  const entry = api?.index.state[binding.state];
  // A key written here is read elsewhere, and the other way round.
  const others = (
    (binding.role === "sends" ? entry?.readers : entry?.writers) ?? []
  ).filter((site) => siteKey(site) !== siteKey(own));
  const othersTitle = binding.role === "sends" ? "Read by" : "Written by";

  return (
    <li className="hkp-binding-row">
      <div className="hkp-binding-verb">{verbOf(binding)}</div>
      <div className="hkp-binding-name">“{binding.state}”</div>
      {binding.role === "shows" && entry?.seeded && (
        <div className="hkp-binding-note">Starts with the facade's initial state.</div>
      )}
      <div className="hkp-binding-note">
        {others.length === 0 ? (
          binding.role === "sends" ? (
            "No other widget reads it."
          ) : entry?.seeded ? (
            "No widget writes it."
          ) : (
            <span className="hkp-binding-note--warn">Nothing writes it.</span>
          )
        ) : (
          <>
            {othersTitle}{" "}
            {others.map((site, i) => (
              <span key={siteKey(site)}>
                {i > 0 && " · "}
                {site.kind === "widget" ? (
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
          </>
        )}
      </div>
    </li>
  );
}
