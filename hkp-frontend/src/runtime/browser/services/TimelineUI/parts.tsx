import {
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { update } from "../CanvasUI/canvasDraw";
import { formatTime, snap } from "./model";

/** Time under the pointer, on an element spanning `length`; null where it cannot be told. */
function timeAt(event: PointerEvent, element: HTMLElement, length: number): number | null {
  const rect = element.getBoundingClientRect();
  const fraction = rect.width > 0 ? (event.clientX - rect.left) / rect.width : NaN;
  if (!Number.isFinite(fraction)) {
    return null;
  }
  return Math.min(Math.max(fraction, 0), 1) * length;
}

function tickStep(length: number): number {
  if (length <= 2) {
    return 0.25;
  }
  if (length <= 12) {
    return 1;
  }
  if (length <= 40) {
    return 5;
  }
  return 10;
}

const percent = (t: number, length: number) =>
  `${length > 0 ? (Math.min(Math.max(t, 0), length) / length) * 100 : 0}%`;

/** The time axis. Pressing or dragging on it scrubs. */
export function Ruler({
  length,
  onScrub,
}: {
  length: number;
  /** Absent, the ruler only shows time. */
  onScrub?: (t: number) => void;
}) {
  const dragging = useRef(false);
  const step = tickStep(length);
  const ticks = Array.from(
    { length: Math.floor(length / step + 1e-9) + 1 },
    (_, i) => i * step,
  );

  const scrub = (event: PointerEvent<HTMLDivElement>) => {
    const t = timeAt(event, event.currentTarget, length);
    if (t !== null) {
      onScrub?.(snap(t));
    }
  };

  return (
    <div
      className={`relative h-5 select-none ${onScrub ? "cursor-ew-resize" : ""}`}
      style={{ borderBottom: "1px solid var(--border-mid)", touchAction: "none" }}
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        scrub(event);
      }}
      onPointerMove={(event) => {
        if (dragging.current) {
          scrub(event);
        }
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      {ticks.map((t) => (
        <div
          key={t}
          className="absolute bottom-0 text-[10px] leading-none"
          style={{ left: percent(t, length), color: "var(--text-mid)" }}
        >
          <div style={{ width: 1, height: 5, background: "var(--border-mid)" }} />
          <span
            className="absolute bottom-[7px]"
            style={{
              transform: t === 0 ? "none" : t >= length ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {Number.isInteger(t) ? t : t.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The playhead's line, over whatever sits in the same positioned box. */
export function Playhead({ t, length, inset = 0 }: { t: number; length: number; inset?: number }) {
  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0"
      style={{
        left: `calc(${inset}px + (100% - ${inset}px) * ${length > 0 ? Math.min(t, length) / length : 0})`,
        width: 1,
        background: "var(--hkp-accent)",
      }}
    />
  );
}

export type Marker = {
  at: number;
  shape: "key" | "action";
  selected?: boolean;
  title?: string;
};

/**
 * One row of markers along the time axis. A marker is picked by pressing it
 * and moved by dragging; pressing the row elsewhere scrubs.
 */
export function Lane({
  markers,
  length,
  onScrub,
  onSelect,
  onMove,
  height = 22,
}: {
  markers: Marker[];
  length: number;
  onScrub?: (t: number) => void;
  onSelect?: (index: number) => void;
  onMove?: (index: number, at: number) => void;
  height?: number;
}) {
  const [drag, setDrag] = useState<{ index: number; at: number; moved: boolean } | null>(
    null,
  );

  return (
    <div
      className="relative select-none"
      style={{
        height,
        touchAction: "none",
        background: "color-mix(in srgb, var(--border-mid) 25%, transparent)",
        borderRadius: 4,
      }}
      onPointerDown={(event) => {
        const t = timeAt(event, event.currentTarget, length);
        if (event.target === event.currentTarget && t !== null) {
          onScrub?.(snap(t));
        }
      }}
      onPointerMove={(event) => {
        const t = timeAt(event, event.currentTarget, length);
        if (drag && t !== null) {
          const at = snap(t);
          if (at !== drag.at) {
            setDrag({ ...drag, at, moved: true });
          }
        }
      }}
      onPointerUp={() => {
        if (drag?.moved) {
          onMove?.(drag.index, drag.at);
        }
        setDrag(null);
      }}
    >
      {markers.map((marker, index) => {
        const at = drag?.index === index ? drag.at : marker.at;
        const color = marker.selected ? "var(--hkp-accent)" : "var(--text-mid)";
        const style: CSSProperties =
          marker.shape === "key"
            ? {
                width: 9,
                height: 9,
                transform: "translate(-50%, -50%) rotate(45deg)",
                background: color,
                top: "50%",
              }
            : {
                width: 3,
                height: height - 6,
                transform: "translateX(-50%)",
                background: color,
                top: 3,
                borderRadius: 1,
              };
        return (
          <div
            key={index}
            title={marker.title ?? formatTime(marker.at)}
            className={`absolute ${onMove ? "cursor-grab" : onSelect ? "cursor-pointer" : ""}`}
            style={{ ...style, left: percent(at, length) }}
            onPointerDown={(event) => {
              event.stopPropagation();
              event.currentTarget.parentElement?.setPointerCapture(event.pointerId);
              onSelect?.(index);
              if (onMove) {
                setDrag({ index, at: marker.at, moved: false });
              }
            }}
          />
        );
      })}
    </div>
  );
}

/** Reads a dropped or picked image file as a data URL. */
function readImage(file: File | undefined, onImage: (url: string) => void) {
  if (!file || !file.type.startsWith("image/")) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === "string") {
      onImage(reader.result);
    }
  };
  reader.readAsDataURL(file);
}

/**
 * The object as it is drawn at the playhead, drawn the way the Canvas service
 * draws it. An image dropped here — or picked, by pressing it — becomes what
 * the timeline animates.
 */
export function Preview({
  drawable,
  width,
  height,
  onImage,
  children,
}: {
  drawable: Record<string, unknown> | null;
  width: number;
  height: number;
  /** Absent, nothing can be dropped or picked: the preview only shows. */
  onImage?: (url: string) => void;
  children?: ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const images = useRef<Record<string, HTMLImageElement>>({});
  const picker = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (canvas.current && drawable) {
      update(canvas.current, drawable, true, images.current, () => {});
    }
  }, [drawable]);

  return (
    <div
      className={`relative overflow-hidden ${onImage ? "cursor-pointer" : ""}`}
      style={{
        width,
        height,
        borderRadius: 6,
        border: over
          ? "1px solid var(--hkp-accent)"
          : `1px ${onImage ? "dashed" : "solid"} var(--border-mid)`,
      }}
      title={onImage ? "Drop an image here, or click to choose one" : undefined}
      onClick={() => onImage && picker.current?.click()}
      onDragOver={(event) => {
        if (onImage && event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (onImage) {
          readImage(event.dataTransfer.files[0], onImage);
        }
      }}
    >
      {drawable ? (
        <canvas ref={canvas} width={width} height={height} />
      ) : (
        <div
          className="flex h-full items-center justify-center px-3 text-center text-xs"
          style={{ color: "var(--text-mid)" }}
        >
          {children ?? (onImage ? "Drop an image to animate it" : "Nothing to show")}
        </div>
      )}
      {onImage && (
        <input
          ref={picker}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            readImage(event.target.files?.[0], onImage);
            event.target.value = "";
          }}
        />
      )}
    </div>
  );
}

/**
 * A field that commits on Enter or on leaving it, and otherwise follows the
 * value it is given — so it moves with the playhead unless it is being typed in.
 */
export function Field({
  value,
  onCommit,
  width = 72,
  title,
  readOnly = false,
}: {
  value: string;
  onCommit: (text: string) => void;
  width?: number;
  title?: string;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(value);
    }
  }, [value, focused]);

  return (
    <input
      title={title}
      value={draft}
      readOnly={readOnly}
      className="rounded px-1 py-0.5 text-xs"
      style={{
        width,
        background: "transparent",
        border: "1px solid var(--border-mid)",
        color: "var(--text)",
      }}
      onFocus={() => setFocused(true)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setFocused(false);
        if (draft !== value) {
          onCommit(draft);
        }
      }}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          setDraft(value);
          setFocused(false);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

/** A property's key button: filled where a keyframe sits at the playhead. */
export function KeyButton({
  animated,
  here,
  onClick,
  disabled = false,
}: {
  animated: boolean;
  here: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const color = animated ? "var(--hkp-accent)" : "var(--text-mid)";
  return (
    <button
      type="button"
      className="hkp-svc-btn hkp-svc-btn--icon flex items-center justify-center"
      style={{ width: 22, height: 22 }}
      disabled={disabled}
      title={
        disabled
          ? here
            ? "A keyframe here"
            : undefined
          : here
            ? "Remove the keyframe here"
            : "Set a keyframe here"
      }
      onClick={onClick}
    >
      <span
        style={{
          width: 8,
          height: 8,
          transform: "rotate(45deg)",
          border: `1.5px solid ${color}`,
          background: here ? color : "transparent",
        }}
      />
    </button>
  );
}
