import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { LayoutItem, LayoutContainer, LayoutWidget, KnobWidget, RepeatWidget, FacadeStateRef } from "../types";
import { PanelContext, widgetRegistry } from "./widgetRegistry";
import { useFacadeState } from "../FacadeStateContext";

export function isContainer(item: LayoutItem): item is LayoutContainer | LayoutWidget {
  return "items" in item && (!("type" in item) || (item as any).type !== "repeat");
}

function isStateRef(value: unknown): value is FacadeStateRef {
  return typeof value === "object" && value !== null && "$state" in value;
}

// Recursively replaces "{{item}}" in string values with the current item.
function interpolateTemplate(template: unknown, item: unknown): unknown {
  if (typeof template === "string") {
    if (template === "{{item}}") { return item; }
    if (typeof item === "string") { return template.replace(/\{\{item\}\}/g, item); }
    return template;
  }
  if (Array.isArray(template)) {
    return template.map((v) => interpolateTemplate(v, item));
  }
  if (template !== null && typeof template === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(template)) {
      result[k] = interpolateTemplate(v, item);
    }
    return result;
  }
  return template;
}

// Walk the layout tree and collect initial knob values keyed by action.serviceUuid.
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
    acc[knob.action.serviceUuid] = knob.defaultValue;
  }
}

export function LayoutNode({
  item,
  boardContext,
  panelContext,
}: {
  item: LayoutItem;
  boardContext: BoardContextState;
  panelContext: PanelContext;
}) {
  const { state: facadeState } = useFacadeState();

  if ("type" in item && item.type === "repeat") {
    const repeat = item as RepeatWidget;
    const rawItems = isStateRef(repeat.items)
      ? facadeState[(repeat.items as FacadeStateRef)["$state"]]
      : repeat.items;
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

    return (
      <div style={containerStyle}>
        {items.map((it, i) => {
          const resolved = interpolateTemplate(repeat.template, it) as LayoutItem;
          return (
            <LayoutNode
              key={i}
              item={resolved}
              boardContext={boardContext}
              panelContext={panelContext}
            />
          );
        })}
      </div>
    );
  }

  if (isContainer(item)) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: item.direction,
          gap: item.gap,
          padding: item.padding,
          alignItems: item.align,
          justifyContent: item.justify,
          flexWrap: item.wrap ? "wrap" : undefined,
          flex: item.fill || item.grow ? 1 : undefined,
          overflow: item.grow ? "hidden" : undefined,
        }}
      >
        {item.items.map((child, i) => (
          <LayoutNode
            key={i}
            item={child}
            boardContext={boardContext}
            panelContext={panelContext}
          />
        ))}
      </div>
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

  return (
    <div style={leafStyle}>
      <Renderer
        widget={item}
        boardContext={boardContext}
        panelContext={panelContext}
      />
    </div>
  );
}
