/**
 * The board seen from outside: every runtime, every service, every nesting
 * level at once, with a camera that can be moved around it.
 *
 * The playground shows one level at a time because that is what building on a
 * board needs — a pipeline you can reach into and change. This is the other
 * half: nothing here is editable, and in exchange the whole board is visible
 * while it runs, including the levels a flat list keeps folded away.
 *
 * It covers the window rather than taking a pane, and the board stays mounted
 * underneath it: panels register the channel their service reports on when they
 * mount, and services that draw have nowhere to draw once they are gone. Coming
 * back finds the board exactly as it was left.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useBoardContext } from "hkp-frontend/src/BoardContext";
import { useNestedNavigation } from "hkp-frontend/src/runtime/ui/NestedNavigation";
import { ActivityTracker } from "./activity";
import { Camera, createCamera, orbit, pan, project, zoom } from "./camera";
import { OverviewNode, buildScene } from "./graph";
import { ServicesByRuntime, readBoardShape } from "./shape";
import { HitTarget, defaultPalette, hitTest, render } from "./render";
import { useOverview } from "./OverviewContext";
import OverviewDetails from "./OverviewDetails";
import { NodeActivity } from "./activity";

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
  labelFor: (uuid: string) => string,
  navigation: ReturnType<typeof useNestedNavigation>,
) {
  if (navigation) {
    node.ancestry.forEach((hostUuid, depth) => {
      navigation.open(hostUuid, labelFor(hostUuid), depth);
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera | null>(null);
  const hitsRef = useRef<HitTarget[]>([]);
  const trackerRef = useRef<ActivityTracker | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const [hovered, setHovered] = useState<OverviewNode | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  selectedRef.current = selectedUuid;

  // What the tracker knows about the selected node, sampled rather than
  // watched: it is written to on every call a service takes, which on a board
  // driven by a timer is far more often than a panel should be redrawn.
  const [selectedActivity, setSelectedActivity] = useState<{
    activity?: NodeActivity;
    processing: boolean;
    now: number;
  }>({ processing: false, now: 0 });

  const visible = !!overview?.visible;

  // The chrome is painted from the same palette the scene is, so the bar and
  // the tooltip cannot end up describing a different view than the canvas.
  const palette = useMemo(() => defaultPalette(accentColor()), []);

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

  const scene = useMemo(() => {
    if (!boardContext) {
      return null;
    }
    // The descriptors draw the board straight away; what the services report
    // replaces them a moment later, and is what carries the nesting.
    return buildScene(boardContext.runtimes, reported ?? boardContext.services);
    // The scene is rebuilt whenever the board's shape changes. Configuration
    // that leaves the shape alone does not touch these slices, and depending on
    // the whole context instead would rebuild it on every board render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardContext?.runtimes, boardContext?.services, reported]);

  const labelFor = useCallback(
    (uuid: string) => scene?.byUuid.get(uuid)?.label ?? "Pipeline",
    [scene],
  );

  const resetCamera = useCallback(() => {
    if (scene) {
      cameraRef.current = createCamera(scene.center, scene.radius);
    }
  }, [scene]);

  // The camera is framed once per board and then left alone — a board that
  // grows a service while being watched must not throw away where the camera
  // was put. Which board it was framed for is remembered rather than compared
  // against the camera being unset, so loading a different board frames again.
  const framedBoardRef = useRef<string | null>(null);
  const boardName = boardContext?.boardName ?? "";
  useEffect(() => {
    if (!scene) {
      return;
    }
    if (!cameraRef.current || framedBoardRef.current !== boardName) {
      cameraRef.current = createCamera(scene.center, scene.radius);
      framedBoardRef.current = boardName;
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
          hoveredUuid: hoveredRef.current,
          selectedUuid: selectedRef.current,
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
      cameraRef.current = drag.panning
        ? pan(camera, dx, dy)
        : orbit(camera, dx, dy);
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const hit = hitTest(hitsRef.current, x, y);
    const uuid = hit?.uuid ?? null;
    // Moving within the same card changes nothing that is drawn from state —
    // the tooltip is placed from the node's projected position, not the
    // pointer — so only crossing into a different card is worth a render.
    if (uuid === hoveredRef.current) {
      return;
    }
    hoveredRef.current = uuid;
    const node = uuid ? scene?.byUuid.get(uuid) : undefined;
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
    setSelectedUuid(hit?.uuid ?? null);
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
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [visible]);

  useEffect(() => {
    if (!visible || !selectedUuid) {
      setSelectedActivity({ processing: false, now: 0 });
      return;
    }
    const sample = () => {
      const activity = trackerRef.current?.get(selectedUuid);
      setSelectedActivity({
        activity: activity ? { ...activity } : undefined,
        processing: activity?.startedAt !== undefined,
        now: performance.now(),
      });
    };
    sample();
    const timer = setInterval(sample, 250);
    return () => clearInterval(timer);
  }, [visible, selectedUuid]);

  // A node stops existing when the board it was on changes shape under the
  // view; the panel must not go on describing it.
  useEffect(() => {
    if (selectedUuid && scene && !scene.byUuid.has(selectedUuid)) {
      setSelectedUuid(null);
    }
  }, [scene, selectedUuid]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // The panel is what was opened last, so it is what closes first.
        if (selectedRef.current) {
          setSelectedUuid(null);
          return;
        }
        overview?.hide();
      }
      if (event.key === "r" || event.key === "R") {
        resetCamera();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, overview, resetCamera]);

  if (!visible || !scene || !boardContext) {
    return null;
  }

  const selected = selectedUuid
    ? (scene.byUuid.get(selectedUuid) ?? null)
    : null;

  const hoveredPoint =
    hovered && cameraRef.current
      ? project(cameraRef.current, hovered, {
          width: canvasRef.current?.clientWidth ?? 0,
          height: canvasRef.current?.clientHeight ?? 0,
        })
      : null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: palette.background,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 14px",
          borderBottom: `1px solid ${palette.cardBorder}`,
          background: palette.card,
          color: palette.textMuted,
          fontFamily: "monospace",
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, color: palette.text }}>
          {boardContext.boardName || "Board"}
        </span>
        <span style={{ opacity: 0.6 }}>
          {scene.nodes.length} services · {scene.runtimes.length} runtimes
        </span>
        <span style={{ opacity: 0.45, marginLeft: "auto" }}>
          drag orbit · shift-drag pan · wheel zoom · click to inspect · R reset
        </span>
        <button
          onClick={() => overview?.hide()}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: `1px solid ${palette.cardBorder}`,
            background: "transparent",
            color: palette.text,
            cursor: "pointer",
            fontSize: 11,
            fontFamily: "monospace",
          }}
        >
          {"{ close }"}
        </button>
      </div>

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
                left: Math.min(hoveredPoint.x + 14, window.innerWidth - 260),
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
                {hovered.depth > 0 ? ` · level ${hovered.depth}` : ""}
                {hovered.bypassed ? " · bypassed" : ""}
              </div>
              {trackerRef.current?.get(hovered.uuid) && (
                <div style={{ color: palette.textMuted }}>
                  {trackerRef.current.get(hovered.uuid)?.calls} calls · last{" "}
                  {trackerRef.current.get(hovered.uuid)?.lastOut?.summary}
                </div>
              )}
            </div>
          )}
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
            onClose={() => setSelectedUuid(null)}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
