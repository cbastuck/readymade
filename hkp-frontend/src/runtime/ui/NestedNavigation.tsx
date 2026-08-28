/**
 * Drilling into nested pipelines without leaving the board behind.
 *
 * A sub-pipeline used to be readable only through the panel of the service
 * hosting it, nested one card inside another for as deep as the board goes.
 * Here a pipeline is *opened* instead: it takes over the canvas as a level of
 * its own, and a breadcrumb trail says where that is and walks back out.
 *
 * Every level stays **mounted**. A service panel is not only a view — it
 * registers the channel its service reports on when it mounts, and services
 * that draw (Canvas, XY Pad) have nowhere to draw once it is gone. So levels
 * are layered over one another rather than swapped: the top one is opaque and
 * covers the rest, and the ones underneath keep their layout, their size, and
 * everything they had running.
 *
 * A level's content is not lifted out of the tree that owns it. The service
 * hosting a pipeline renders it exactly as it always did and *portals* it onto
 * the layer, so what is on screen stays live and stays inside its host's render
 * — no copy of the pipeline is kept here that could go stale. Nesting follows
 * from that on its own: a portalled level contains panels that host pipelines
 * of their own, each able to open one level deeper.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

/** One open level: the pipeline that was opened, and what to call it. */
export type NestedLevel = { id: string; label: string };

export type NestedNavigation = {
  /** The open levels, outermost first. `stack[d]` is the level at depth d + 1. */
  stack: NestedLevel[];
  /** Opens a pipeline from a host sitting at `depth`, closing anything deeper. */
  open: (id: string, label: string, depth: number) => void;
  /** Closes a level and everything below it. A no-op if it is not open. */
  close: (id: string) => void;
  /** Walks back out to `depth`; 0 is the board itself. */
  goTo: (depth: number) => void;
  /** Where a level of this depth renders, once its layer exists. */
  layerFor: (depth: number) => HTMLElement | null;
};

/**
 * Null wherever no provider is mounted — the mobile host, an embedded board, a
 * facade. Hosts read that as "nothing to open here" and stay as they were.
 */
export const NestedNavContext = createContext<NestedNavigation | null>(null);

/** How deep the surrounding tree already is. The board itself is 0. */
export const LevelDepthContext = createContext(0);

export function useNestedNavigation(): NestedNavigation | null {
  return useContext(NestedNavContext);
}

export function useLevelDepth(): number {
  return useContext(LevelDepthContext);
}

type Props = {
  /** The board canvas. It keeps rendering underneath every open level. */
  children: React.ReactNode;
  /** The first crumb, naming what the levels are nested in. */
  rootLabel?: string;
};

export default function NestedNavProvider({
  children,
  rootLabel = "Board",
}: Props) {
  const [stack, setStack] = useState<NestedLevel[]>([]);
  const [layers, setLayers] = useState<Map<number, HTMLElement>>(new Map());

  // One ref callback per depth, kept across renders. A fresh callback each
  // render would have React detach and reattach the node every time, and the
  // state that follows would render again — forever.
  const refsByDepth = useRef(
    new Map<number, (node: HTMLDivElement | null) => void>(),
  );

  const layerRef = useCallback((depth: number) => {
    const cached = refsByDepth.current.get(depth);
    if (cached) {
      return cached;
    }
    const callback = (node: HTMLDivElement | null) => {
      setLayers((prev) => {
        const next = new Map(prev);
        if (node) {
          next.set(depth, node);
        } else {
          next.delete(depth);
        }
        return next;
      });
    };
    refsByDepth.current.set(depth, callback);
    return callback;
  }, []);

  const navigation = useMemo<NestedNavigation>(
    () => ({
      stack,
      open: (id, label, depth) =>
        setStack((prev) => [...prev.slice(0, depth), { id, label }]),
      close: (id) =>
        setStack((prev) => {
          const at = prev.findIndex((level) => level.id === id);
          return at === -1 ? prev : prev.slice(0, at);
        }),
      goTo: (depth) => setStack((prev) => prev.slice(0, depth)),
      layerFor: (depth) => layers.get(depth) ?? null,
    }),
    [stack, layers],
  );

  const depth = stack.length;

  return (
    <NestedNavContext.Provider value={navigation}>
      {/* `minWidth: 0` on every box down to the canvas. A flex item's automatic
          minimum size is its content, so without it these would grow to fit the
          widest runtime instead of the window — and the canvas inside them,
          which is what actually scrolls, would be handed that width and scroll
          against the wrong extent. The canvas escaped this on its own only
          because `overflow: auto` zeroes that minimum. */}
      <div
        style={{
          position: "relative",
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {depth > 0 && (
          <Breadcrumbs
            stack={stack}
            rootLabel={rootLabel}
            onGoTo={navigation.goTo}
          />
        )}

        <div
          style={{
            position: "relative",
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* The board. Covered while a level is open, never unmounted: the
              panels on it keep reporting, and anything drawing keeps its size.
              `inert` only takes it out of reach — nothing on it stops running. */}
          <div
            inert={depth > 0}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {children}
          </div>

          {stack.map((level, index) => (
            <div
              key={level.id}
              ref={layerRef(index + 1)}
              // Only the topmost layer is reachable. `inert` keeps the focus
              // ring and the screen reader out of what is covered — which is
              // still there, still running, just not what is being looked at.
              inert={index < depth - 1}
              style={{
                position: "absolute",
                inset: 0,
                overflow: "auto",
                background: "var(--bg-app, #fafafa)",
                zIndex: 10 + index,
              }}
            />
          ))}
        </div>
      </div>
    </NestedNavContext.Provider>
  );
}

function Breadcrumbs({
  stack,
  rootLabel,
  onGoTo,
}: {
  stack: NestedLevel[];
  rootLabel: string;
  onGoTo: (depth: number) => void;
}) {
  const crumbs = [{ id: "__root", label: rootLabel }, ...stack];

  return (
    <nav
      aria-label="Nested pipeline"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexShrink: 0,
        overflowX: "auto",
        padding: "6px 12px",
        borderBottom: "1px solid hsl(var(--border))",
        background: "var(--bg-app, #fafafa)",
      }}
    >
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <div
            key={crumb.id}
            style={{ display: "flex", alignItems: "center", flexShrink: 0 }}
          >
            <button
              className="hkp-crumb-link"
              onClick={() => onGoTo(index)}
              disabled={isLast}
              aria-current={isLast ? "page" : undefined}
            >
              {crumb.label}
            </button>
            {!isLast && (
              <span
                aria-hidden="true"
                style={{
                  margin: "0 6px",
                  fontSize: 12,
                  opacity: 0.45,
                  flexShrink: 0,
                }}
              >
                /
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
