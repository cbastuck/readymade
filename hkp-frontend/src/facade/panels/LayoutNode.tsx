import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { LayoutItem, LayoutContainer, LayoutWidget, KnobWidget } from "../types";
import { PanelContext, widgetRegistry } from "./widgetRegistry";

export function isContainer(item: LayoutItem): item is LayoutContainer | LayoutWidget {
  return "items" in item;
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
