/**
 * The board seen from outside: every runtime, every service, every nesting
 * level at once, with a camera that can be moved around it.
 *
 * The playground shows one level at a time because that is what building on a
 * board needs — a pipeline you can reach into and change. This is the other
 * half: nothing here is editable, and in exchange the whole board is visible
 * while it runs, including the levels a flat list keeps folded away.
 *
 * It is the board seen another way rather than a place of its own: it takes
 * the runtimes' place wherever they are shown — beside the facade, or as the
 * whole board where there is no facade — and is switched to and from in the
 * toolbar. Its own choice, the layout, floats over the scene instead, so the
 * toolbar does not change when the view does. The runtimes stay mounted
 * underneath it: panels register the channel their service reports on when
 * they mount, and services that draw have nowhere to draw once they are gone.
 * Coming back finds the board exactly as it was left.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useBoardContext } from "hkp-frontend/src/BoardContext";
import { useTheme } from "hkp-frontend/src/ui-components/ThemeContext";
import { useNestedNavigation } from "hkp-frontend/src/runtime/ui/NestedNavigation";
import { ActivityTracker } from "./activity";
import { Camera, createCamera, orbit, pan, project, zoom } from "./camera";
import { OverviewNode, buildScene, keyOf } from "./graph";
import { ServicesByRuntime, readBoardShape } from "./shape";
import { HitTarget, defaultPalette, hitTest, render } from "./render";
import { useOverview } from "./OverviewContext";
import OverviewDetails from "./OverviewDetails";
import OverviewLayoutControls from "./OverviewLayoutControls";
import { NodeActivity } from "./activity";

/** Whether a key pressed here was typed into something that takes text. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/** Stands in before the board is being listened to, so a frame drawn in
 *  between shows every node idle rather than allocating a tracker to say so. */
const IDLE_ACTIVITY = new ActivityTracker();

/** How long a service stays marked after the overview has jumped to it. */
const REVEAL_HIGHLIGHT_MS = 2000;
/** How long to keep looking for a service's panel after opening its levels. */
const REVEAL_TIMEOUT_MS = 2000;

/** What the accent is where no theme defines one, and where one is defined in
 *  a form the canvas cannot be handed. */
const FALLBACK_ACCENT = "#0abcfb";

/**
 * The theme's accent, as something a canvas can be given.
 *
 * The token is authored in whatever colour space the theme was written in —
 * the playground's is `oklch` — while everything here hands the colour
 * straight to a canvas as a fill, a stroke and a shadow, and mixes it towards
 * white for the colour a lit card takes. So it is put through a canvas first,
 * which either hands back a plain hex or does not recognise it and leaves the
 * probe's own value in place; anything that does not come back as a hex is not
 * something the rest of this can use, and the documented accent stands in.
 */
function accentColor(): string {
  if (typeof window === "undefined") {
    return FALLBACK_ACCENT;
  }
  const declared = getComputedStyle(document.documentElement)
    .getPropertyValue("--hkp-accent")
    .trim();
  if (!declared) {
    return FALLBACK_ACCENT;
  }

  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) {
    return FALLBACK_ACCENT;
  }
  probe.fillStyle = FALLBACK_ACCENT;
  probe.fillStyle = declared;
  const resolved = String(probe.fillStyle);
  return /^#[0-9a-f]{6}$/i.test(resolved) ? resolved : FALLBACK_ACCENT;
}

/**
 * Brings a service into view on the board.
 *
 * A nested service is only on screen once every pipeline above it has been
 * opened, so the hosts are opened outermost first — each one renders the level
 * the next is found on. The panel therefore does not exist yet when the last
 * one is asked for, and is waited for rather than assumed.
 */
function revealService(
  node: OverviewNode,
  labelFor: (key: string) => string,
  navigation: ReturnType<typeof useNestedNavigation>,
) {
  if (navigation) {
    node.ancestry.forEach((hostUuid, depth) => {
      navigation.open(
        hostUuid,
        labelFor(keyOf(node.ancestry.slice(0, depth), hostUuid)),
        depth,
      );
    });
    if (node.ancestry.length === 0) {
      navigation.goTo(0);
    }
  }

  const deadline = performance.now() + REVEAL_TIMEOUT_MS;
  const look = () => {
    // The frame a service renders in already carries an id built from its
    // uuid, which is the same id a nested entry is reported under.
    const element = document.getElementById(`service-frame-${node.uuid}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("hkp-service-card--revealed");
      setTimeout(
        () => element.classList.remove("hkp-service-card--revealed"),
        REVEAL_HIGHLIGHT_MS,
      );
      return;
    }
    if (performance.now() < deadline) {
      requestAnimationFrame(look);
    }
  };
  requestAnimationFrame(look);
}

export default function OverviewView() {
  const overview = useOverview();
  const boardContext = useBoardContext();
  const navigation = useNestedNavigation();
  const theme = useTheme();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera | null>(null);
  const hitsRef = useRef<HitTarget[]>([]);
  const trackerRef = useRef<ActivityTracker | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const [hovered, setHovered] = useState<OverviewNode | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  selectedRef.current = selectedKey;

  // What the tracker knows about the selected node, sampled rather than
  // watched: it is written to on every call a service takes, which on a board
  // driven by a timer is far more often than a panel should be redrawn.
  const [selectedActivity, setSelectedActivity] = useState<{
    activity?: NodeActivity;
    processing: boolean;
    now: number;
  }>({ processing: false, now: 0 });

  const visible = !!overview?.visible;

  // The chrome is painted from the same palette the scene is, so the layout
  // control and the tooltip cannot end up describing a different view than
  // the canvas.
  // The theme comes into it for one thing only: what a runtime that was never
  // given a colour stands on, which is the same appearance default the board
  // itself is drawn with.
  const palette = useMemo(
    () => defaultPalette(accentColor(), theme.runtimeBackgroundColor),
    [theme.runtimeBackgroundColor],
  );

  // What the services report about themselves, which is where a pipeline built
  // in this session is. Read when the view opens, and again whenever the board
  // gains or loses a service — the two moments the answer can have changed.
  const [reported, setReported] = useState<ServicesByRuntime | null>(null);
  useEffect(() => {
    if (!visible || !boardContext) {
      setReported(null);
      return;
    }
    let current = true;
    readBoardShape({
      runtimes: boardContext.runtimes,
      services: boardContext.services,
      scopes: boardContext.scopes,
      runtimeApis: boardContext.runtimeApis,
    })
      .then((shape) => {
        if (current) {
          setReported(shape);
        }
      })
      .catch(() => {
        // Nothing to show for it: the descriptors below still draw a board.
      });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, boardContext?.runtimes, boardContext?.services]);

  // Chosen on the view, and kept in the context so it outlives closing it.
  const layout = overview?.layout ?? "lanes";

  const scene = useMemo(() => {
    if (!boardContext) {
      return null;
    }
    // The descriptors draw the board straight away; what the services report
    // replaces them a moment later, and is what carries the nesting.
    return buildScene(
      boardContext.runtimes,
      reported ?? boardContext.services,
      layout,
    );
    // The scene is rebuilt whenever the board's shape changes. Configuration
    // that leaves the shape alone does not touch these slices, and depending on
    // the whole context instead would rebuild it on every board render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardContext?.runtimes, boardContext?.services, reported, layout]);

  const labelFor = useCallback(
    (key: string) => scene?.byKey.get(key)?.label ?? "Pipeline",
    [scene],
  );

  // Whether the camera has been flown since it was last framed.
  const cameraMovedRef = useRef(false);

  const resetCamera = useCallback(() => {
    if (scene) {
      cameraRef.current = createCamera(scene.center, scene.radius);
      cameraMovedRef.current = false;
    }
  }, [scene]);

  // The camera frames the board, and goes on framing it as the scene changes
  // until someone flies it — from then on it is left alone, since a board that
  // grows a service while being watched must not throw away where the camera
  // was put. Framing only once would frame the wrong thing: the descriptors
  // draw the board first and carry no nesting, and the shape the services
  // report replaces them a moment later, so the first scene of a nested board
  // is a fraction of it. Which board it was framed for is remembered rather
  // than compared against the camera being unset, so loading a different
  // board frames again.
  const framedBoardRef = useRef<string | null>(null);

  // A different layout puts everything somewhere else, so where the camera was
  // flown to no longer frames anything in particular: it frames the board
  // again. Before the framing below, which reads this in the same commit.
  useEffect(() => {
    cameraMovedRef.current = false;
  }, [layout]);
  const boardName = boardContext?.boardName ?? "";
  useEffect(() => {
    if (!scene) {
      return;
    }
    if (
      !cameraRef.current ||
      framedBoardRef.current !== boardName ||
      !cameraMovedRef.current
    ) {
      cameraRef.current = createCamera(scene.center, scene.radius);
      framedBoardRef.current = boardName;
      cameraMovedRef.current = false;
    }
  }, [scene, boardName]);

  // Closing leaves the pointer wherever it was; reopening should not come back
  // with a tooltip for whatever it was last over.
  useEffect(() => {
    if (!visible) {
      hoveredRef.current = null;
      setHovered(null);
    }
  }, [visible]);

  // ── listening to the board ───────────────────────────────────────────────
  useEffect(() => {
    if (!visible || !scene || !boardContext) {
      return;
    }
    const tracker = new ActivityTracker();
    trackerRef.current = tracker;
    const detach = tracker.attach(
      scene.nodes,
      scene.edges,
      boardContext.scopes,
    );
    return () => {
      detach();
      trackerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, scene, boardContext?.scopes]);

  // ── the render loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || !scene) {
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }

    let frame = 0;
    let stopped = false;

    const draw = () => {
      if (stopped) {
        return;
      }
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
        canvas.width = width * ratio;
        canvas.height = height * ratio;
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      const camera = cameraRef.current;
      if (camera) {
        hitsRef.current = render(ctx, {
          scene,
          camera,
          viewport: { width, height },
          activity: trackerRef.current ?? IDLE_ACTIVITY,
          palette,
          now: performance.now(),
          hoveredKey: hoveredRef.current,
          selectedKey: selectedRef.current,
        });
      }
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
    };
  }, [visible, scene, palette]);

  // ── camera controls ──────────────────────────────────────────────────────
  const dragRef = useRef<{
    x: number;
    y: number;
    panning: boolean;
    moved: number;
  } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    (event.target as HTMLCanvasElement).setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      // The middle button and a held shift pan; anything else orbits.
      panning: event.button === 1 || event.shiftKey,
      moved: 0,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    if (!canvas || !camera) {
      return;
    }
    const drag = dragRef.current;

    if (drag) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      cameraMovedRef.current = true;
      cameraRef.current = drag.panning
        ? pan(camera, dx, dy)
        : orbit(camera, dx, dy);
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const hit = hitTest(hitsRef.current, x, y);
    const key = hit?.key ?? null;
    // Moving within the same card changes nothing that is drawn from state —
    // the tooltip is placed from the node's projected position, not the
    // pointer — so only crossing into a different card is worth a render.
    if (key === hoveredRef.current) {
      return;
    }
    hoveredRef.current = key;
    const node = key ? scene?.byKey.get(key) : undefined;
    setHovered(node ?? null);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas || !drag || drag.moved > 4) {
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    const hit = hitTest(
      hitsRef.current,
      event.clientX - bounds.left,
      event.clientY - bounds.top,
    );
    // Selecting rather than leaving: what a node is takes reading, and going
    // to it is one of the things the panel then offers.
    setSelectedKey(hit?.key ?? null);
  };

  const openInPlayground = useCallback(
    (node: OverviewNode) => {
      overview?.hide();
      // Named before the trip, so the way back can say where it goes back from.
      overview?.setRevealed({ uuid: node.uuid, label: node.label });
      revealService(node, labelFor, navigation);
    },
    [overview, labelFor, navigation],
  );

  // Wheel is bound directly rather than through React: zooming has to stop the
  // page from scrolling, and React's wheel handler cannot.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || !canvas) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (cameraRef.current) {
        cameraRef.current = zoom(cameraRef.current, event.deltaY);
        cameraMovedRef.current = true;
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [visible]);

  useEffect(() => {
    if (!visible || !selectedKey) {
      setSelectedActivity({ processing: false, now: 0 });
      return;
    }
    const sample = () => {
      const activity = trackerRef.current?.get(selectedKey);
      setSelectedActivity({
        activity: activity ? { ...activity } : undefined,
        processing: activity?.startedAt !== undefined,
        now: performance.now(),
      });
    };
    sample();
    const timer = setInterval(sample, 250);
    return () => clearInterval(timer);
  }, [visible, selectedKey]);

  // The overview is the board seen whole, and a level drilled into covers the
  // board — this included — so it opens on the top level.
  useEffect(() => {
    if (visible) {
      navigation?.goTo(0);
    }
    // Only on opening: the details panel opens levels on its way out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // A node stops existing when the board it was on changes shape under the
  // view; the panel must not go on describing it.
  useEffect(() => {
    if (selectedKey && scene && !scene.byKey.has(selectedKey)) {
      setSelectedKey(null);
    }
  }, [scene, selectedKey]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      // Typing belongs to where it is typed: with the facade on screen beside
      // the overview, an R written into one of its fields is not a request to
      // reset the camera.
      if (isEditable(event.target)) {
        return;
      }
      // Escape closes the panel and nothing more: switching back to the
      // runtimes is the toolbar's, and Escape already means something to the
      // facade around this.
      if (event.key === "Escape" && selectedRef.current) {
        setSelectedKey(null);
        return;
      }
      if (event.key === "r" || event.key === "R") {
        resetCamera();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, resetCamera]);

  if (!visible || !scene || !boardContext) {
    return null;
  }

  const selected = selectedKey
    ? (scene.byKey.get(selectedKey) ?? null)
    : null;

  const hoveredPoint =
    hovered && cameraRef.current
      ? project(cameraRef.current, hovered, {
          width: canvasRef.current?.clientWidth ?? 0,
          height: canvasRef.current?.clientHeight ?? 0,
        })
      : null;

  return (
    <div
      style={{
        // Fills whatever holds it — the pane beside the facade, or the board —
        // which gives it a size to fill.
        position: "absolute",
        inset: 0,
        background: palette.background,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flex: 1,
          minHeight: 0,
        }}
      >
        <div
          style={{ position: "relative", flex: 1, minWidth: 0, minHeight: 0 }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={() => {
              hoveredRef.current = null;
              setHovered(null);
            }}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              cursor: hovered ? "pointer" : "grab",
              touchAction: "none",
            }}
          />

          {scene.nodes.length === 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: palette.textMuted,
                fontFamily: "monospace",
                fontSize: 13,
                pointerEvents: "none",
              }}
            >
              This board has no services yet.
            </div>
          )}

          {hovered && hoveredPoint && (
            <div
              style={{
                position: "absolute",
                // Kept inside the view, which is not the window's width when
                // it shares the board with the facade.
                left: Math.min(
                  hoveredPoint.x + 14,
                  (canvasRef.current?.clientWidth ?? window.innerWidth) - 260,
                ),
                top: hoveredPoint.y + 14,
                pointerEvents: "none",
                background: palette.card,
                border: `1px solid ${palette.cardBorder}`,
                borderRadius: 6,
                boxShadow: "0 6px 20px rgba(34, 38, 43, 0.16)",
                padding: "8px 10px",
                color: palette.text,
                fontFamily: "monospace",
                fontSize: 11,
                lineHeight: 1.5,
                maxWidth: 240,
              }}
            >
              <div style={{ fontWeight: 600 }}>{hovered.label}</div>
              <div style={{ color: palette.textMuted }}>
                {hovered.serviceId}
              </div>
              <div style={{ color: palette.textMuted }}>
                {hovered.runtimeId}
                {/* Which of its host's pipelines it is in, where the host
                    holds more than one and the name is what tells them
                    apart — an endpoint's onProcess from its onRequest. */}
                {hovered.pipeline ? ` · ${hovered.pipeline}` : ""}
                {hovered.depth > 0 ? ` · level ${hovered.depth}` : ""}
                {hovered.bypassed ? " · bypassed" : ""}
              </div>
              {trackerRef.current?.get(hovered.key) && (
                <div style={{ color: palette.textMuted }}>
                  {trackerRef.current.get(hovered.key)?.calls} calls · last{" "}
                  {trackerRef.current.get(hovered.key)?.lastOut?.summary}
                </div>
              )}
            </div>
          )}

          <OverviewLayoutControls palette={palette} />
        </div>

        {selected && (
          <OverviewDetails
            node={selected}
            scene={scene}
            runtimeLabel={
              scene.runtimes.find((r) => r.id === selected.runtimeId)?.label ??
              selected.runtimeId
            }
            activity={selectedActivity.activity}
            processing={selectedActivity.processing}
            now={selectedActivity.now}
            palette={palette}
            onOpenInPlayground={() => openInPlayground(selected)}
            onClose={() => setSelectedKey(null)}
          />
        )}
      </div>

    </div>
  );
}
