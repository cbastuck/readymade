import { CSSProperties } from "react";

import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { LayoutItem, LayoutContainer, LayoutWidget, KnobWidget, RepeatWidget, FacadeStateRef } from "../types";
import { PanelContext, widgetRegistry } from "./widgetRegistry";
import { useFacadeState } from "../FacadeStateContext";
import { CollapsibleSection } from "./CollapsibleSection";
import { useNotificationValue } from "./renderers/StatusIndicatorRenderer";
import { interpolateTemplate } from "../itemTemplate";
import { useMissingServices } from "../serviceNotifications";
import { BindingSite, bindingServices, siteKey, widgetBindings } from "../bindings";
import { SITE_ATTRIBUTE, useFacadeBindings } from "../FacadeBindingsContext";
import { BindingsBadge } from "./BindingsBadge";

export function isContainer(item: LayoutItem): item is LayoutContainer | LayoutWidget {
  return "items" in item && (!("type" in item) || (item as any).type !== "repeat");
}

function isStateRef(value: unknown): value is FacadeStateRef {
  return typeof value === "object" && value !== null && "$state" in value;
}

// Walk the layout tree and collect initial knob values, keyed the way
// KnobRenderer reads them back: by the knob's id, or its service uuid.
export function collectKnobDefaults(
  item: LayoutItem,
  acc: Record<string, number>,
): void {
  if (isContainer(item)) {
    for (const child of item.items) {
      collectKnobDefaults(child, acc);
    }
    return;
  }
  if (item.type === "knob") {
    const knob = item as KnobWidget;
    acc[knob.id ?? knob.action.serviceUuid] = knob.defaultValue;
  }
}

/**
 * A container's padding, as the four sides.
 *
 * `padding` is both axes; `paddingX` and `paddingY` override one of them, so a
 * column can be inset from a panel's edges without its first widget being
 * pushed down from the title above it.
 *
 * Resolved to longhands rather than mixed with the shorthand: React warns when
 * a style object carries both `padding` and a `paddingLeft` it covers, and
 * which one wins would depend on key order.
 */
function paddingOf(item: LayoutContainer): CSSProperties {
  const { padding, paddingX, paddingY } = item;
  if (
    padding === undefined &&
    paddingX === undefined &&
    paddingY === undefined
  ) {
    return {};
  }
  const x = paddingX ?? padding;
  const y = paddingY ?? padding;
  return {
    paddingLeft: x,
    paddingRight: x,
    paddingTop: y,
    paddingBottom: y,
  };
}

/**
 * Where a node sits: its panel and its position in that panel's layout, the
 * same address `facadeBindings` gives it (see `BindingSite`). Absent where a
 * layout is drawn outside a panel — a preview — which then has no badges.
 */
export type NodeSite = { panel: string; path: (number | "template")[] };

function childSite(
  site: NodeSite | undefined,
  step: number | "template",
): NodeSite | undefined {
  return site ? { panel: site.panel, path: [...site.path, step] } : undefined;
}

export function LayoutNode({
  item,
  boardContext,
  panelContext,
  site,
}: {
  item: LayoutItem;
  boardContext: BoardContextState;
  panelContext: PanelContext;
  site?: NodeSite;
}) {
  const { state: facadeState } = useFacadeState();
  const bindingsView = useFacadeBindings();

  // Asked for unconditionally, because a hook cannot be: a node that is not a
  // repeat, or a repeat taking its items from the board, passes no source and
  // the hook watches nothing.
  const repeatSource =
    "type" in item && item.type === "repeat"
      ? (item as RepeatWidget).source
      : undefined;
  const sourcedItems = useNotificationValue(boardContext, repeatSource);

  // Unconditional for the same reason, and asked of every kind of node rather
  // than only the widget leaves that draw the answer below: a uuid the board
  // has nothing under is worth saying wherever it was written.
  const bindings = widgetBindings(item);
  const missingServices = useMissingServices(
    boardContext,
    bindingServices(bindings),
  );

  if ("type" in item && item.type === "repeat") {
    const repeat = item as RepeatWidget;
    // `items` wins where a board wrote one, so a source is what a repeat falls
    // back to rather than something that can quietly override what was written.
    const rawItems =
      repeat.items !== undefined
        ? isStateRef(repeat.items)
          ? facadeState[(repeat.items as FacadeStateRef)["$state"]]
          : repeat.items
        // The source's path is already walked by the hook that read it.
        : sourcedItems;
    const items = Array.isArray(rawItems) ? rawItems : [];
    const containerStyle = repeat.columns != null
      ? {
          display: "grid" as const,
          gridTemplateColumns: `repeat(${repeat.columns}, 1fr)`,
          gap: repeat.gap,
        }
      : {
          display: "flex" as const,
          flexDirection: (repeat.direction ?? "column") as "row" | "column",
          gap: repeat.gap,
          flexWrap: (repeat.wrap ? "wrap" : undefined) as "wrap" | undefined,
        };

    const stripe = repeat.stripe;
    const frame = repeat.frame;
    if (frame && items.length === 0) {
      return null;
    }

    return (
      <div
        style={
          frame
            ? {
                ...containerStyle,
                border: "1px solid hsl(var(--border))",
                borderRadius: frame.radius ?? 8,
                padding: frame.padding ?? 8,
                maxWidth: frame.maxWidth,
                boxSizing: "border-box",
              }
            : containerStyle
        }
      >
        {items.map((it, i) => {
          const resolved = interpolateTemplate(repeat.template, it) as LayoutItem;
          const node = (
            <LayoutNode
              key={i}
              item={resolved}
              boardContext={boardContext}
              panelContext={panelContext}
              // Every item is the template's, which is one site for all of
              // them: what it names is the same key whichever item names it.
              site={childSite(site, "template")}
            />
          );
          if (!stripe) {
            return node;
          }
          // The band is a wrapper rather than something pushed into the
          // template: the template describes one item, and which of two
          // colours it sits on is a fact about its position in the list.
          return (
            <div
              key={i}
              style={{
                background: i % 2 === 0 ? stripe.even : stripe.odd,
                padding: stripe.padding,
                borderRadius: stripe.radius,
                minWidth: 0,
              }}
            >
              {node}
            </div>
          );
        })}
      </div>
    );
  }

  if (isContainer(item)) {
    const contents = (
      <div
        style={{
          display: "flex",
          flexDirection: item.direction,
          gap: item.gap,
          ...paddingOf(item),
          alignItems: item.align,
          justifyContent: item.justify,
          flexWrap: item.wrap ? "wrap" : undefined,
          flex: item.fill || item.grow ? 1 : undefined,
          overflow: item.grow ? "hidden" : undefined,
          ...(item.width !== undefined
            ? { width: item.width, flexShrink: 1, minWidth: 0 }
            : {}),
        }}
      >
        {item.items.map((child, i) => (
          <LayoutNode
            key={i}
            item={child}
            boardContext={boardContext}
            panelContext={panelContext}
            site={childSite(site, i)}
          />
        ))}
      </div>
    );

    if (!item.collapsible) {
      return contents;
    }
    return (
      <CollapsibleSection container={item} boardContext={boardContext}>
        {contents}
      </CollapsibleSection>
    );
  }

  const Renderer = widgetRegistry[item.type];
  if (!Renderer) {
    return null;
  }

  const leafStyle = item.grow
    ? {
        flex: 1,
        overflow: "hidden" as const,
        display: "flex" as const,
        flexDirection: "column" as const,
      }
    : undefined;

  // The badge sits over the widget's corner, so the wrapper is what it is
  // placed against — but only while badges are drawn, so a facade without
  // them lays out exactly as it always has.
  const bindingSite: BindingSite | undefined = site
    ? {
        kind: "widget",
        ...site,
        type: item.type,
        label:
          typeof (item as { label?: unknown }).label === "string"
            ? (item as { label: string }).label
            : undefined,
      }
    : undefined;
  const badge = !!bindingsView && !!bindingSite && bindings.length > 0;

  return (
    <div
      style={badge ? { ...leafStyle, position: "relative" } : leafStyle}
      className={badge ? "hkp-binding-host" : undefined}
      {...(bindingSite ? { [SITE_ATTRIBUTE]: siteKey(bindingSite) } : {})}
    >
      {badge && <BindingsBadge bindings={bindings} site={bindingSite!} />}
      <Renderer
        widget={item}
        boardContext={boardContext}
        panelContext={panelContext}
      />
      {missingServices.length > 0 && (
        <MissingServices uuids={missingServices} />
      )}
    </div>
  );
}

/**
 * A widget addressing something the board does not have.
 *
 * Said where the widget is, because that is the only thing that turns "the
 * board does nothing" into a place to look: the panel, the position, and the
 * uuid as it was written — which is usually enough to see the typo in it.
 *
 * Beside the widget rather than instead of it. A widget may name two services
 * and have only one of them wrong, and what still works should still be there;
 * a board that is merely broken should not also look empty.
 */
function MissingServices({ uuids }: { uuids: string[] }) {
  return (
    <div
      style={{
        fontSize: 11,
        lineHeight: 1.4,
        color: "#ef4444",
        wordBreak: "break-all",
      }}
    >
      {uuids.map((uuid) => `no service “${uuid}”`).join(" · ")}
    </div>
  );
}
