import { CSSProperties, useEffect, useRef, useState } from "react";
import { useBoardContext, BoardContextState } from "../../../BoardContext";
import {
  ProcessContext,
  RuntimeClass,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceAction,
  ServiceClassWithPreset,
  ServiceDescriptor,
  ServiceRegistry,
  isRuntimeBrowserClassType,
  isRuntimeRestClassType,
  toCanonicalRuntimeClassType,
  toCanonicalServiceId,
} from "../../../types";
import { toast } from "sonner";
import { M, SERVICE_UI_ZOOM } from "./tokens";
import MobileIcon, { type MobileIconName } from "./MobileIcon";
import AddRuntimeSheet from "./AddRuntimeSheet";
import AddServiceSheet from "./AddServiceSheet";
import ServiceSheet from "./ServiceSheet";
import RunSheet from "./RunSheet";
import MakeBlockSheet from "./MakeBlockSheet";
import BottomSheet from "./BottomSheet";
import { findServiceUI } from "../../../runtime/browser/UIRegistry";
import BrowserRuntimeScope from "../../../runtime/browser/BrowserRuntimeScope";
import MobileFacadeView from "./MobileFacadeView";
import { passesNothing } from "../../../runtime/rest/Data";
import { boardRun } from "../../../runtime/processContext";
import type { AssistFocus } from "../../../assist/useBoardAssist";
import { narrowBoardContext } from "../../../facade/boardServices";
import { useEditReportingService } from "../../../core/editedServices";
import { runRuntime } from "../../../core/play";
import { SUB_SERVICE_ID, paletteFor } from "../../../core/palette";
import { contiguousRun } from "../../../runtime/board/wrap";
import { blockUseAt } from "../../../runtime/board/blocks";
import { usePresetsForService } from "../../../ui-components/service/usePresetsForService";
import {
  blockNameForRun,
  makeBlockOfRun,
  wrapRun,
} from "../../../ui-components/runtime-ui/WrapSelection";
import { ProcessingSweep } from "../../../ui-components/service/processingSweep";
import {
  BoardFlow,
  BoardFlowContext,
  useServiceActivity,
  useServiceFlow,
} from "./boardFlow";
import {
  CaptureControl,
  CaptureControlContext,
  useCaptureControl,
} from "./capture";
import FlowSheet from "./FlowSheet";
import { ServiceUIPanel } from "./serviceUI";
import { isTooLarge } from "../../../runtime/callReport";
import {
  flowText,
  previewFlow,
  timeOf,
} from "../../../ui-components/service/flowRecords";

// Presence of a `bridge` prop means this canvas renders a *cloud* board: browser
// runtime results are forwarded to the coordinator over `bridge.ws`. When omitted
// the canvas is a local playground board and results chain to the next runtime.
export type MobileBoardBridge = { ws: WebSocket | null };

type MobileBoardCanvasProps = {
  bridge?: MobileBoardBridge;
  /**
   * The Capture mode switch, where it is not this window's: a deployed board
   * is switched by its coordinator. Left out, the canvas switches its own.
   */
  capture?: CaptureControl;
  /**
   * Told which runtime, and which of its services, the person opened last —
   * what a phone has in place of the desktop's selection, and what Board
   * Assist narrows a request to.
   */
  onFocus?: (focus: AssistFocus) => void;
};

// ── Flow connector between service cards ───────────────────────
function FlowArrow() {
  return (
    <div
      style={{ display: "flex", justifyContent: "center", padding: "5px 0" }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <div style={{ width: 1.5, height: 10, background: M.borderStrong }} />
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "4px solid transparent",
            borderRight: "4px solid transparent",
            borderTop: `5px solid ${M.borderStrong}`,
          }}
        />
      </div>
    </div>
  );
}

// ── Runtime-to-runtime connector ───────────────────────────────
function RuntimeConnector() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "8px 0",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{ height: 1, flex: 1, background: M.borderStrong, maxWidth: 60 }}
      />
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: M.textMuted,
          textTransform: "uppercase",
          background: M.bg,
          padding: "0 6px",
        }}
      >
        output ↓
      </span>
      <div
        style={{ height: 1, flex: 1, background: M.borderStrong, maxWidth: 60 }}
      />
    </div>
  );
}

// ── Reorder steppers (up/down) ─────────────────────────────────
// Shared by service cards and runtime rows in reorder mode. Ends are disabled
// (can't move the first item up or the last item down).
function Stepper({
  canUp,
  canDown,
  onUp,
  onDown,
}: {
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  const btn = (enabled: boolean): CSSProperties => ({
    width: 34,
    height: 30,
    border: `1px solid ${M.border}`,
    borderRadius: 8,
    background: enabled ? "#fff" : "rgba(0,0,0,0.03)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: enabled ? "pointer" : "default",
    padding: 0,
  });
  return (
    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
      <button
        onClick={onUp}
        disabled={!canUp}
        aria-label="Move up"
        style={btn(canUp)}
      >
        <MobileIcon
          name="chevronUp"
          size={15}
          color={canUp ? M.textSecondary : M.textMuted}
          strokeWidth={2}
        />
      </button>
      <button
        onClick={onDown}
        disabled={!canDown}
        aria-label="Move down"
        style={btn(canDown)}
      >
        <MobileIcon
          name="chevronDown"
          size={15}
          color={canDown ? M.textSecondary : M.textMuted}
          strokeWidth={2}
        />
      </button>
    </div>
  );
}

// ── Service card ───────────────────────────────────────────────
// A card's colour while its service runs: the header tint of the desktop's frame.
const RUNNING_TINT = "#f0faf8";

/** How much of the latest output an expanded card shows; Inspect has it all. */
const LATEST_CHARS = 1200;

/**
 * What an expanded card shows below its row: what the service passed on last,
 * while Capture mode is on — observing a board without opening anything — and
 * the way to the rest of it.
 */
function ServiceCardDetails({
  runtime,
  service,
  onInspect,
  onOpen,
}: {
  runtime: RuntimeDescriptor;
  service: ServiceDescriptor;
  onInspect: () => void;
  onOpen: () => void;
}) {
  const capture = useCaptureControl();
  const { output } = useServiceFlow(runtime.id, service.uuid);
  // Further still: the service's own panel, below the buttons — a Monitor or
  // a meter watched in the list beside the others.
  const [showUI, setShowUI] = useState(false);
  const latest = output[0];

  const label: CSSProperties = {
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: M.textMuted,
  };
  const button: CSSProperties = {
    flex: 1,
    height: 38,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <>
      <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
        {capture.on ? (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 6,
              }}
            >
              <span style={label}>Latest output</span>
              {latest && (
                <span
                  style={{
                    fontSize: 11,
                    color: M.textMuted,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {timeOf(latest.at)}
                </span>
              )}
            </div>
            {latest ? (
              <pre
                aria-label="Latest output"
                style={{
                  margin: 0,
                  padding: "8px 10px",
                  maxHeight: 140,
                  overflow: "hidden",
                  background: "#f8f5f2",
                  border: `1px solid ${M.border}`,
                  borderRadius: 10,
                  fontSize: 11.5,
                  lineHeight: 1.4,
                  color: M.textPrimary,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {isTooLarge(latest.data)
                  ? previewFlow(latest.data)
                  : flowText(latest.data).slice(0, LATEST_CHARS)}
              </pre>
            ) : (
              <div style={{ fontSize: 12.5, color: M.textMuted }}>
                Nothing produced yet.
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 12.5,
              lineHeight: 1.4,
              color: M.textSecondary,
            }}
          >
            <span style={{ flex: 1 }}>
              Capture mode is off, so what this service passes on is not shown.
            </span>
            <button
              onClick={() => capture.set(true)}
              disabled={capture.busy}
              style={{
                flexShrink: 0,
                height: 30,
                padding: "0 10px",
                border: `1px solid ${M.danger}`,
                borderRadius: 8,
                background: "#fff",
                color: M.danger,
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 600,
                cursor: capture.busy ? "default" : "pointer",
                opacity: capture.busy ? 0.5 : 1,
              }}
            >
              Turn on
            </button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowUI((shown) => !shown)}
            aria-expanded={showUI}
            style={{
              ...button,
              border: `1.5px solid ${showUI ? M.teal : M.border}`,
              background: showUI ? M.tealLight : M.card,
              color: showUI ? M.tealDark : M.textSecondary,
            }}
          >
            <MobileIcon
              name={showUI ? "minimize2" : "maximize2"}
              size={13}
              color={showUI ? M.tealDark : M.textSecondary}
            />
            UI
          </button>
          {/* Plain like the others: teal in this row means UI is shown, and
              Inspect only opens a sheet. */}
          <button
            onClick={onInspect}
            style={{
              ...button,
              border: `1.5px solid ${M.border}`,
              background: M.card,
              color: M.textSecondary,
            }}
          >
            <MobileIcon name="activity" size={14} color={M.textSecondary} />
            Inspect
          </button>
          {/* Everything else about the service: its sheet. */}
          <button
            onClick={onOpen}
            aria-label="More"
            title="Everything else about this service"
            style={{
              ...button,
              flex: "0 0 46px",
              border: `1.5px solid ${M.border}`,
              background: M.card,
              color: M.textSecondary,
            }}
          >
            <MobileIcon name="more" size={16} color={M.textSecondary} />
          </button>
        </div>
      </div>
      {/* The width of the card, so the panel has all the room there is. */}
      {showUI && (
        <div
          data-service-ui
          style={{ borderTop: `1px solid ${M.border}`, background: "#fff" }}
        >
          <ServiceUIPanel runtime={runtime} service={service} />
        </div>
      )}
    </>
  );
}

function ServiceCard({
  service,
  runtime,
  onTap,
  onInspect,
  active,
  reordering,
  canUp,
  canDown,
  onMoveUp,
  onMoveDown,
  selected,
}: {
  service: ServiceDescriptor;
  runtime: RuntimeDescriptor;
  /** Picks it in selection mode, and opens its sheet otherwise. */
  onTap: () => void;
  /** Opens what it received and passed on. */
  onInspect: () => void;
  active: boolean;
  reordering: boolean;
  canUp: boolean;
  canDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** Picked in selection mode; undefined outside it, where a tap expands it. */
  selected?: boolean;
}) {
  // Whether it is running, as the desktop's frame shows it: what is happening
  // on the board is seen without opening anything.
  const activity = useServiceActivity(runtime.id, service.uuid);
  // Expanded, it shows what the service passed on last. Each card on its own,
  // so several can be watched at once.
  const [expanded, setExpanded] = useState(false);
  const body = (
    <>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          background: M.tealLight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <MobileIcon name="cpu" size={18} color={M.tealDark} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: M.textPrimary }}>
          {service.serviceName}
        </div>
        {service.description && (
          <div
            style={{
              fontSize: 12,
              color: M.textMuted,
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {service.description}
          </div>
        )}
      </div>
    </>
  );

  const cardStyle: CSSProperties = {
    width: "100%",
    position: "relative",
    overflow: "hidden",
    background: activity.running ? RUNNING_TINT : M.card,
    border: `1.5px solid ${active ? M.teal : M.border}`,
    borderRadius: 14,
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    textAlign: "left",
    boxShadow: active
      ? `0 0 0 3px ${M.tealLight}`
      : "0 1px 3px rgba(0,0,0,0.06)",
    transition: "all 0.15s",
  };
  const sweep = activity.sweeping && (
    <ProcessingSweep run={activity.run} color={M.teal} />
  );

  if (reordering) {
    // A static row dedicated to reordering — tapping the body does nothing; the
    // steppers own all interaction.
    return (
      <div
        data-running={activity.running || undefined}
        style={{ ...cardStyle, cursor: "default", marginBottom: 8 }}
      >
        {body}
        {sweep}
        <Stepper
          canUp={canUp}
          canDown={canDown}
          onUp={onMoveUp}
          onDown={onMoveDown}
        />
      </div>
    );
  }

  if (selected !== undefined) {
    // Selection mode: a tap picks or unpicks, the box in place of the steppers.
    return (
      <div>
        <button
          onClick={onTap}
          role="checkbox"
          aria-checked={selected}
          data-running={activity.running || undefined}
          style={{
            ...cardStyle,
            cursor: "pointer",
            border: `1.5px solid ${selected ? M.teal : M.border}`,
            boxShadow: selected ? `0 0 0 3px ${M.tealLight}` : cardStyle.boxShadow,
          }}
        >
          {body}
          {sweep}
          <MobileIcon
            name={selected ? "checkSquare" : "square"}
            size={22}
            color={selected ? M.teal : M.borderStrong}
            strokeWidth={selected ? 2 : 1.6}
          />
        </button>
        <FlowArrow />
      </div>
    );
  }

  return (
    <div>
      <div
        data-service-card={service.uuid}
        data-running={activity.running || undefined}
        style={{ ...cardStyle, display: "block", padding: 0 }}
      >
        <button
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          style={{
            width: "100%",
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            border: "none",
            background: "none",
            textAlign: "left",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          {body}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: activity.running ? M.teal : M.green,
                boxShadow: activity.running ? `0 0 0 3px ${M.tealLight}` : "none",
              }}
            />
            <MobileIcon
              name={expanded ? "chevronUp" : "chevronDown"}
              size={14}
              color={M.textMuted}
            />
          </div>
        </button>
        {expanded && (
          <ServiceCardDetails
            runtime={runtime}
            service={service}
            onInspect={onInspect}
            onOpen={onTap}
          />
        )}
        {sweep}
      </div>
      <FlowArrow />
    </div>
  );
}

// ── Runtime menu entry ─────────────────────────────────────────
function MenuItem({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: MobileIconName;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  const color = danger ? M.danger : M.textPrimary;
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        border: "none",
        background: M.card,
        cursor: "pointer",
        textAlign: "left",
        fontSize: 15,
        fontFamily: "inherit",
        fontWeight: 500,
        color,
      }}
    >
      <MobileIcon name={icon} size={17} color={danger ? M.danger : M.textSecondary} />
      {label}
    </button>
  );
}

// ── Selection bar (selection mode) ─────────────────────────────
// Sticks to the bottom of the board list while the runtime's services are on
// screen, so the actions stay in reach of a thumb however long the list is.
function SelectionBar({
  count,
  contiguous,
  onWrap,
  onMakeBlock,
  onCancel,
}: {
  count: number;
  /** Whether the picked services sit next to each other — their order is their wiring. */
  contiguous: boolean;
  onWrap: () => void;
  onMakeBlock: () => void;
  onCancel: () => void;
}) {
  const enabled = count > 0 && contiguous;
  const action = (primary: boolean): CSSProperties => ({
    flex: 1,
    height: 40,
    border: primary ? "none" : `1.5px solid ${M.teal}`,
    borderRadius: 10,
    background: primary ? M.teal : M.tealLight,
    color: primary ? "#fff" : M.tealDark,
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 600,
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.45,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  });
  return (
    <div
      data-testid="mobile-selection-bar"
      style={{
        position: "sticky",
        bottom: 0,
        margin: "0 12px 12px",
        padding: 10,
        background: M.card,
        border: `1px solid ${M.border}`,
        borderRadius: 14,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ flex: 1, fontSize: 13, color: M.textSecondary }}>
          {count === 0
            ? "Tap services to select them"
            : !contiguous
              ? "Only services next to each other can be wrapped"
              : `${count} ${count === 1 ? "service" : "services"} selected`}
        </span>
        <button
          onClick={onCancel}
          style={{
            border: "none",
            background: "none",
            color: M.textSecondary,
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            padding: "4px 6px",
          }}
        >
          Done
        </button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={!enabled} onClick={onWrap} style={action(false)}>
          <MobileIcon name="layers" size={14} color={M.tealDark} />
          Wrap
        </button>
        <button disabled={!enabled} onClick={onMakeBlock} style={action(true)}>
          <MobileIcon name="boxes" size={14} color="#fff" />
          Make block
        </button>
      </div>
    </div>
  );
}

// ── Runtime card ───────────────────────────────────────────────
function RuntimeCard({
  runtime,
  services,
  boardContext,
  activeServiceId,
  onServiceTap,
  onInspect,
  onAddService,
  onRemoveRuntime,
  structural,
  onRunWith,
  onMakeBlock,
}: {
  runtime: RuntimeDescriptor;
  services: ServiceDescriptor[];
  registry: ServiceRegistry;
  boardName: string;
  boardContext: BoardContextState;
  activeServiceId: string | null;
  onServiceTap: (svc: ServiceDescriptor, rt: RuntimeDescriptor) => void;
  onInspect: (svc: ServiceDescriptor, rt: RuntimeDescriptor) => void;
  onAddService: () => void;
  onRemoveRuntime: () => void;
  /** Whether what the board is made of may change here (see ServiceSheet). */
  structural: boolean;
  onRunWith: () => void;
  /** Asks for a name, then makes a block of these services. */
  onMakeBlock: (uuids: string[]) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const closeMenu = () => {
    setMenuOpen(false);
    setConfirmClear(false);
  };
  const [reordering, setReordering] = useState(false);
  // Reordering is only meaningful with 2+ services; if a removal drops the list
  // to a single service, fall back to the normal (tappable) rendering.
  const isReordering = reordering && services.length > 1;
  // Selection mode: services picked to be wrapped in a sub-service, or made a
  // block, in one step. Kept in the runtime's order, which is their wiring.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const canSelect =
    structural &&
    (isRuntimeBrowserClassType(runtime.type) || isRuntimeRestClassType(runtime.type));
  const isSelecting = selecting && canSelect && services.length > 0;
  const order = services.map((svc) => svc.uuid);
  const pickedInOrder = order.filter((uuid) => picked.includes(uuid));
  const contiguous = pickedInOrder.length > 0 && !!contiguousRun(order, pickedInOrder);

  const stopSelecting = () => {
    setSelecting(false);
    setPicked([]);
  };

  const togglePicked = (uuid: string) =>
    setPicked((current) =>
      current.includes(uuid)
        ? current.filter((id) => id !== uuid)
        : [...current, uuid],
    );

  // The whole runtime as one block: what selecting every service and making a
  // block of them does. A runtime holding just one sub-service already is a
  // pipeline, which is made a block where it is rather than wrapped again; one
  // holding just a use of a block has nothing to make.
  const only = services.length === 1 ? services[0] : null;
  const onlyIsUse =
    !!only && !!blockUseAt(boardContext.linkage?.blocks, only.uuid, runtime.id);
  const onlyIsSubService =
    !!only && toCanonicalServiceId(only.serviceId) === SUB_SERVICE_ID;
  const canMakeBlockOfAll = canSelect && services.length > 0 && !onlyIsUse;
  const makeBlockOfAll = () => {
    if (only && onlyIsSubService) {
      boardContext
        .makeBlock(only.uuid, runtime.id)
        .then((made) =>
          toast.success(`"${made.name}" is now a block of this board`, {
            description: "Add it again from Building Blocks.",
          }),
        )
        .catch((err) =>
          toast.error("Could not make a block", { description: err.message }),
        );
      return;
    }
    onMakeBlock(order);
  };

  const run = () => {
    if (runRuntime(boardContext, runtime.id)) {
      toast.success(`Running “${runtime.name}”`);
    } else {
      toast.error("The runtime is not running yet");
    }
  };

  const moveService = (svc: ServiceDescriptor, index: number, dir: -1 | 1) => {
    // reorderService treats the target as an insertion slot and subtracts 1 when
    // moving down; up → index-1, down → index+2 lands the service one slot over.
    const target = dir === -1 ? index - 1 : index + 2;
    boardContext.arrangeService(runtime, svc.uuid, target);
  };

  return (
    <div
      style={{
        background: M.runtimeBg,
        border: `1.5px solid ${M.runtimeBorder}`,
        borderRadius: 18,
        // Clipped rather than hidden: hidden would make the card a scroll
        // container, and the selection bar would stick to it, not the list.
        overflow: "clip",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: M.blue,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: M.blue,
              }}
            >
              Runtime
            </span>
            <span
              style={{
                fontSize: 10,
                background: M.blueLight,
                color: M.blue,
                padding: "1px 6px",
                borderRadius: 4,
                fontWeight: 500,
              }}
            >
              {runtime.type}
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: M.textPrimary,
              marginTop: 1,
            }}
          >
            {runtime.name}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {services.length > 1 && !collapsed && !isSelecting && (
            <button
              onClick={() => setReordering((v) => !v)}
              title={isReordering ? "Done reordering" : "Reorder services"}
              style={{
                width: 28,
                height: 28,
                border: "none",
                background: isReordering ? M.teal : "rgba(255,255,255,0.5)",
                borderRadius: 7,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <MobileIcon
                name={isReordering ? "check" : "moveVertical"}
                size={14}
                color={isReordering ? "#fff" : M.textSecondary}
                strokeWidth={isReordering ? 2.2 : 1.8}
              />
            </button>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: 28,
              height: 28,
              border: "none",
              background: "rgba(255,255,255,0.5)",
              borderRadius: 7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <MobileIcon
              name={collapsed ? "chevronDown" : "chevronUp"}
              size={14}
              color={M.textSecondary}
            />
          </button>
          <div>
            <button
              onClick={() => setMenuOpen(true)}
              title="More options"
              style={{
                width: 28,
                height: 28,
                border: "none",
                background: "rgba(255,255,255,0.5)",
                borderRadius: 7,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <MobileIcon name="more" size={14} color={M.textSecondary} />
            </button>
          </div>
        </div>
      </div>

      {/* Services */}
      {!collapsed && (
        <div style={{ padding: "0 12px 6px" }}>
          {services.length === 0 ? (
            <div
              style={{
                fontSize: 12,
                color: M.textMuted,
                textAlign: "center",
                padding: "8px 0",
                fontStyle: "italic",
              }}
            >
              No services — tap + Service to add one
            </div>
          ) : (
            services.map((svc, i) => (
              <ServiceCard
                key={svc.uuid}
                service={svc}
                runtime={runtime}
                onTap={() =>
                  isSelecting ? togglePicked(svc.uuid) : onServiceTap(svc, runtime)
                }
                onInspect={() => onInspect(svc, runtime)}
                active={activeServiceId === svc.uuid}
                reordering={isReordering}
                canUp={i > 0}
                canDown={i < services.length - 1}
                onMoveUp={() => moveService(svc, i, -1)}
                onMoveDown={() => moveService(svc, i, 1)}
                selected={isSelecting ? picked.includes(svc.uuid) : undefined}
              />
            ))
          )}
        </div>
      )}

      {isSelecting && !collapsed && (
        <SelectionBar
          count={pickedInOrder.length}
          contiguous={contiguous}
          onWrap={() =>
            void wrapRun(boardContext, runtime.id, pickedInOrder).then(
              (done) => done && stopSelecting(),
            )
          }
          onMakeBlock={() => {
            onMakeBlock(pickedInOrder);
            stopSelecting();
          }}
          onCancel={stopSelecting}
        />
      )}

      {!collapsed && !isReordering && !isSelecting && (
        <div style={{ padding: "0px 12px 12px" }}>
          <button
            onClick={onAddService}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "11px 14px",
              border: `1.5px dashed ${M.teal}`,
              borderRadius: 14,
              background: M.tealLight,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              color: M.tealDark,
              fontFamily: "inherit",
            }}
          >
            <MobileIcon name="plus" size={16} color={M.tealDark} />
            Add Service
          </button>
        </div>
      )}

      {/* A sheet rather than a dropdown: the card clips what it holds, and a
          menu this long would be cut off by a card any shorter than it. */}
      <BottomSheet
        open={menuOpen}
        onClose={closeMenu}
        title={runtime.name}
        height="auto"
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            // The frame's colour, showing between the rows, is the line between them.
            gap: 1,
            background: M.border,
            border: `1px solid ${M.border}`,
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <MenuItem
            icon="play"
            label="Run"
            onClick={() => {
              closeMenu();
              run();
            }}
          />
          <MenuItem
            icon="playWith"
            label="Run with…"
            onClick={() => {
              closeMenu();
              onRunWith();
            }}
          />
          {canSelect && services.length > 0 && (
            <MenuItem
              icon="checkSquare"
              label="Select services"
              onClick={() => {
                closeMenu();
                setReordering(false);
                setCollapsed(false);
                setSelecting(true);
              }}
            />
          )}
          {canMakeBlockOfAll && (
            <MenuItem
              icon="boxes"
              label="Make block"
              onClick={() => {
                closeMenu();
                makeBlockOfAll();
              }}
            />
          )}
          {structural && services.length > 0 && (
            <MenuItem
              icon="eraser"
              label={confirmClear ? "Tap again to clear" : "Clear services"}
              danger={confirmClear}
              onClick={() => {
                // Every service goes at once, so the first tap asks.
                if (!confirmClear) {
                  setConfirmClear(true);
                  return;
                }
                closeMenu();
                stopSelecting();
                boardContext.removeAllServices(runtime);
              }}
            />
          )}
          <MenuItem
            icon="trash"
            label="Delete Runtime"
            danger
            onClick={() => {
              closeMenu();
              onRemoveRuntime();
            }}
          />
        </div>
      </BottomSheet>
    </div>
  );
}

// ── Compact runtime row (runtime reorder mode) ─────────────────
function RuntimeReorderRow({
  runtime,
  serviceCount,
  canUp,
  canDown,
  onMoveUp,
  onMoveDown,
}: {
  runtime: RuntimeDescriptor;
  serviceCount: number;
  canUp: boolean;
  canDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div
      style={{
        background: M.runtimeBg,
        border: `1.5px solid ${M.runtimeBorder}`,
        borderRadius: 14,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: M.blue,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: M.textPrimary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {runtime.name}
        </div>
        <div style={{ fontSize: 11, color: M.textMuted, marginTop: 1 }}>
          {runtime.type} · {serviceCount} service{serviceCount !== 1 ? "s" : ""}
        </div>
      </div>
      <Stepper
        canUp={canUp}
        canDown={canDown}
        onUp={onMoveUp}
        onDown={onMoveDown}
      />
    </div>
  );
}

// ── Board list (runtimes + services) ────────────────────────────
function BoardList({
  onServiceTap,
  onInspect,
  activeServiceId,
  onAddService,
  onRemoveRuntime,
  onShowAddRuntime,
  structural,
  onRunWith,
  onMakeBlock,
}: {
  onServiceTap: (svc: ServiceDescriptor, rt: RuntimeDescriptor) => void;
  onInspect: (svc: ServiceDescriptor, rt: RuntimeDescriptor) => void;
  activeServiceId: string | null;
  onAddService: (rt: RuntimeDescriptor) => void;
  onRemoveRuntime: (rt: RuntimeDescriptor) => void;
  onShowAddRuntime: () => void;
  structural: boolean;
  onRunWith: (rt: RuntimeDescriptor) => void;
  onMakeBlock: (rt: RuntimeDescriptor, uuids: string[]) => void;
}) {
  const boardContext = useBoardContext();
  const [reorderingRuntimes, setReorderingRuntimes] = useState(false);
  if (!boardContext) {
    return null;
  }
  const { runtimes, services, registry, boardName } = boardContext;

  // Only meaningful with 2+ runtimes; a removal that drops to one exits the mode.
  const isReorderingRuntimes = reorderingRuntimes && runtimes.length > 1;

  const moveRuntime = (rt: RuntimeDescriptor, index: number, dir: -1 | 1) => {
    // Same insertion-slot semantics as reorderService: up → index-1,
    // down → index+2 (reorderRuntime subtracts 1 when moving down).
    const target = dir === -1 ? index - 1 : index + 2;
    boardContext.arrangeRuntime(rt.id, target);
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        padding: 16,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {isReorderingRuntimes
          ? runtimes.map((rt, i) => (
              <RuntimeReorderRow
                key={rt.id}
                runtime={rt}
                serviceCount={(services[rt.id] ?? []).length}
                canUp={i > 0}
                canDown={i < runtimes.length - 1}
                onMoveUp={() => moveRuntime(rt, i, -1)}
                onMoveDown={() => moveRuntime(rt, i, 1)}
              />
            ))
          : runtimes.map((rt, i) => (
              <div key={rt.id}>
                <RuntimeCard
                  runtime={rt}
                  services={services[rt.id] ?? []}
                  registry={registry[rt.id] ?? []}
                  boardName={boardName ?? ""}
                  boardContext={boardContext}
                  activeServiceId={activeServiceId}
                  onServiceTap={onServiceTap}
                  onInspect={onInspect}
                  onAddService={() => onAddService(rt)}
                  onRemoveRuntime={() => onRemoveRuntime(rt)}
                  structural={structural}
                  onRunWith={() => onRunWith(rt)}
                  onMakeBlock={(uuids) => onMakeBlock(rt, uuids)}
                />
                {i < runtimes.length - 1 && <RuntimeConnector />}
              </div>
            ))}

        {!isReorderingRuntimes && (
          <button
            onClick={onShowAddRuntime}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 14,
              border: `1.5px dashed ${M.borderStrong}`,
              borderRadius: 16,
              background: "rgba(255,255,255,0.5)",
              color: M.textSecondary,
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <MobileIcon name="plus" size={16} color={M.textSecondary} />
            Add Runtime
          </button>
        )}

        {runtimes.length > 1 && (
          <button
            onClick={() => setReorderingRuntimes((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 14,
              border: `1.5px ${isReorderingRuntimes ? "solid" : "dashed"} ${
                isReorderingRuntimes ? M.teal : M.borderStrong
              }`,
              borderRadius: 16,
              background: isReorderingRuntimes
                ? M.teal
                : "rgba(255,255,255,0.5)",
              color: isReorderingRuntimes ? "#fff" : M.textSecondary,
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <MobileIcon
              name={isReorderingRuntimes ? "check" : "moveVertical"}
              size={16}
              color={isReorderingRuntimes ? "#fff" : M.textSecondary}
              strokeWidth={isReorderingRuntimes ? 2.2 : 1.8}
            />
            {isReorderingRuntimes ? "Done" : "Reorder Runtimes"}
          </button>
        )}
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
}

// ── Full-screen single-service view ───────────────────────────
function FullServiceView({
  service,
  runtime,
  onBack,
}: {
  service: ServiceDescriptor;
  runtime: RuntimeDescriptor;
  onBack: () => void;
}) {
  const boardContext = useBoardContext();
  const editable = useEditReportingService();
  if (!boardContext) {
    return null;
  }
  const { scopes } = boardContext;

  const handleServiceAction = (cmd: ServiceAction) => {
    if (cmd.action === "remove") {
      boardContext.removeService({ uuid: cmd.service.uuid }, runtime);
      if (cmd.service.uuid === service.uuid) {
        onBack();
      }
    } else if (cmd.action === "rename" && cmd.payload?.value) {
      boardContext.setServiceName(
        runtime.id,
        cmd.service.uuid,
        cmd.payload.value,
      );
    }
  };

  const browserScope =
    runtime.type === "browser"
      ? (scopes[runtime.id] as BrowserRuntimeScope | undefined)
      : undefined;

  const serviceInstance =
    browserScope?.findServiceInstance(service.uuid)?.[0] ?? null;
  const ServiceUI = serviceInstance
    ? (findServiceUI(service.serviceId) ??
      browserScope?.registry.findServiceModule(service.serviceId)?.createUI ??
      null)
    : null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        background: M.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: `rgba(242,237,232,0.95)`,
          backdropFilter: "blur(12px)",
          paddingTop: "max(10px, env(safe-area-inset-top))",
          paddingBottom: "10px",
          paddingLeft: "4px",
          paddingRight: "16px",
          display: "flex",
          alignItems: "center",
          gap: 4,
          borderBottom: `1px solid ${M.border}`,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 40,
            height: 40,
            border: "none",
            background: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <MobileIcon
            name="chevronLeft"
            size={22}
            color={M.teal}
            strokeWidth={2}
          />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: M.textPrimary,
              lineHeight: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {service.serviceName}
          </div>
          <div style={{ fontSize: 11, color: M.textMuted, marginTop: 2 }}>
            {runtime.name}
          </div>
        </div>
      </div>

      {/* Bare service UI — no runtime chrome */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            zoom: SERVICE_UI_ZOOM,
            width: `calc(100% / ${SERVICE_UI_ZOOM})`,
          }}
        >
          {ServiceUI && serviceInstance ? (
            <ServiceUI
              service={editable(serviceInstance)}
              showBypassOnlyIfExplicit={false}
              draggable={false}
              onServiceAction={handleServiceAction}
            />
          ) : (
            <div
              style={{
                padding: 24,
                fontSize: 14,
                color: M.textMuted,
                textAlign: "center",
              }}
            >
              {scopes[runtime.id]
                ? "Service UI not available"
                : "Runtime not yet initialized"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Wires the per-runtime scope hooks that the desktop `BrowserRuntime` /
 * `RuntimeRest` components normally install (the mobile renderer mounts neither).
 *
 * `scope.onResult` is wired for *every* runtime — without it results have nowhere
 * to go: the coordinator never receives `result-from-browser`, and a remote (REST)
 * runtime awaiting a response (e.g. a C++ HTTP server using RESULT_AWAITING_RESPONSE)
 * is never resolved, so the request hangs. The remaining hooks
 * (`processRuntimeByName`, `configureServiceInRuntime`, `onAction`) are browser-only.
 *
 * - Cloud board (`bridge` set): forward browser results to the coordinator, and
 *   resolve coordinator-initiated calls via `context.onResolve`.
 * - Playground (`bridge` omitted): resolve awaiting callers, else chain results to
 *   the next runtime locally.
 *
 * NOTE: this hook hand-rolls scope wiring that overlaps with the desktop runtime
 * components and `Board`'s `onRuntimeResult`. See `docs/todos/scope-wiring-refactor.md`.
 */
function useWireBrowserScopes(
  boardContext: BoardContextState | null,
  bridge: MobileBoardBridge | undefined,
) {
  // Keep the live bridge in a ref so the onResult closure always sends to the
  // current socket (it reconnects) without re-wiring every scope.
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;

  const runtimes = boardContext?.runtimes;
  const scopes = boardContext?.scopes;

  useEffect(() => {
    if (!boardContext) {
      return;
    }
    const { runtimes, scopes, runtimeApis, appContext, user } = boardContext;

    for (const rt of runtimes) {
      const scope = scopes[rt.id] as RuntimeScope | undefined;
      if (!scope) {
        continue;
      }

      scope.authenticatedUser = user;

      // `onResult` must be wired for *every* runtime that hands a result back to
      // the app, not just browser runtimes. On desktop the per-runtime
      // <BrowserRuntime>/<RuntimeRest> components install it; the mobile renderer
      // mounts neither, so we wire it here. A remote (REST) runtime needs it just
      // as much: a C++ HTTP server using the inversion-of-control pull pattern
      // pushes its result with `context.onResolve` set (RESULT_AWAITING_RESPONSE)
      // and parks the HTTP connection until we resolve it. Left on the unset stub,
      // that resolve never fires and the request hangs forever.
      scope.onResult = async (
        _instanceId: string | null,
        result: unknown,
        context?: ProcessContext | null,
      ) => {
        // A coordinator- or runtime-initiated call carries its own resolver.
        if (context?.onResolve) {
          context.onResolve(result);
          return;
        }

        const carriesOn = !passesNothing(result);

        const activeBridge = bridgeRef.current;
        if (activeBridge) {
          // Cloud board: the coordinator routes to the next runtime — just hand
          // the result back to it.
          const ws = activeBridge.ws;
          if (ws && ws.readyState === WebSocket.OPEN && carriesOn) {
            ws.send(
              JSON.stringify({
                type: "result-from-browser",
                runtimeId: rt.id,
                data: result,
                ...(context?.actor.kind === "board" ? { boardOrigin: true } : {}),
              }),
            );
          }
          return;
        }

        // Playground: chain to the next runtime locally.
        const idx = runtimes.findIndex((r) => r.id === rt.id);
        const next = runtimes[idx + 1];
        const nextScope = next && scopes[next.id];
        const nextApi =
          nextScope &&
          (runtimeApis[next.type] ||
            runtimeApis[toCanonicalRuntimeClassType(next.type)]);
        if (nextApi && nextScope && carriesOn) {
          // Without a run named for it, what a runtime produced is not a
          // gesture of whoever is signed in here; see Board.onRuntimeResult.
          nextApi.processRuntime(
            nextScope,
            result,
            null,
            context ?? boardRun(),
          );
        }
      };

      // The remaining hooks exist only on browser scopes; remote (REST) scopes
      // drive notifications and config through their own REST/WebSocket handlers.
      if (!isRuntimeBrowserClassType(rt.type)) {
        continue;
      }
      const browserScope = scope as BrowserRuntimeScope;

      browserScope.processRuntimeByName = async (
        name: string,
        params: unknown,
        run?: ProcessContext | null,
      ) => {
        const target = runtimes.find((r) => r.name === name);
        if (target) {
          const targetScope = scopes[target.id];
          const targetApi =
            runtimeApis[target.type] ||
            runtimeApis[toCanonicalRuntimeClassType(target.type)];
          if (targetScope && targetApi) {
            return targetApi.processRuntime(targetScope, params, null, run);
          }
        }
        console.error(
          `MobileBoardCanvas.processRuntimeByName: no runtime named "${name}"`,
        );
      };

      browserScope.configureServiceInRuntime = async (
        runtimeId: string,
        serviceUuid: string,
        config: unknown,
        run,
      ) => {
        const targetScope = scopes[runtimeId] as
          | BrowserRuntimeScope
          | undefined;
        const svc = targetScope?.findServiceInstance(serviceUuid)?.[0];
        if (svc?.configure) {
          if (run && targetScope) {
            await targetScope.callInContext(svc, run, () => svc.configure(config));
          } else {
            await svc.configure(config);
          }
        }
      };

      browserScope.coordinator = boardContext?.coordinator ?? null;

      browserScope.onAction = (action: ServiceAction) => {
        if (action.action === "notification" && action.payload) {
          appContext?.pushNotification(action.payload);
          return true;
        }
        return false;
      };
    }
    // Re-wire when the set of runtimes or their scopes changes (e.g. a runtime is
    // added). The bridge socket is read through a ref, so it isn't a dependency.
  }, [boardContext, runtimes, scopes]);
}

// ── App ⇄ Board view toggle (only shown when the board has a facade) ──────────
function ViewToggle({
  view,
  onChange,
}: {
  view: "facade" | "board";
  onChange: (v: "facade" | "board") => void;
}) {
  const segments: Array<{ value: "facade" | "board"; label: string; icon: MobileIconName }> = [
    { value: "facade", label: "App", icon: "home" },
    { value: "board", label: "Board", icon: "list" },
  ];
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "8px 0",
        flexShrink: 0,
        background: M.bg,
        borderBottom: `1px solid ${M.border}`,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          background: M.card,
          border: `1px solid ${M.border}`,
          borderRadius: 10,
          padding: 3,
          gap: 2,
        }}
      >
        {segments.map((seg) => {
          const active = view === seg.value;
          return (
            <button
              key={seg.value}
              onClick={() => onChange(seg.value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                border: "none",
                borderRadius: 8,
                background: active ? M.teal : "transparent",
                color: active ? "#fff" : M.textSecondary,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <MobileIcon
                name={seg.icon}
                size={14}
                color={active ? "#fff" : M.textMuted}
                strokeWidth={active ? 2.2 : 1.8}
              />
              {seg.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Canvas root ─────────────────────────────────────────────────
export default function MobileBoardCanvas({
  bridge,
  capture,
  onFocus,
}: MobileBoardCanvasProps) {
  const boardContext = useBoardContext();

  const [view, setView] = useState<"facade" | "board">("facade");
  const [showAddRuntime, setShowAddRuntime] = useState(false);
  const [addServiceRuntime, setAddServiceRuntime] =
    useState<RuntimeDescriptor | null>(null);
  const [selectedService, setSelectedService] =
    useState<ServiceDescriptor | null>(null);
  const [selectedServiceRuntime, setSelectedServiceRuntime] =
    useState<RuntimeDescriptor | null>(null);
  const [fullScreenService, setFullScreenService] = useState<{
    service: ServiceDescriptor;
    runtime: RuntimeDescriptor;
  } | null>(null);
  const [runWithRuntime, setRunWithRuntime] =
    useState<RuntimeDescriptor | null>(null);
  // The service whose flow is open on its own, from its card's Inspect.
  const [inspected, setInspected] = useState<{
    service: ServiceDescriptor;
    runtime: RuntimeDescriptor;
  } | null>(null);
  const [blockOf, setBlockOf] = useState<{
    runtime: RuntimeDescriptor;
    uuids: string[];
  } | null>(null);
  // A deployed board is attached to, not rebuilt: what it is made of changes
  // in the playground, and is deployed again.
  const structural = !bridge;
  // Kept current while the board is open, so a preset kept from a service's
  // sheet is in the add sheet the next time it opens.
  const subServicePresets = usePresetsForService(SUB_SERVICE_ID);

  useWireBrowserScopes(boardContext, bridge);

  // What every service received and passed on, from the moment the board is
  // shown: the cards' activity and each service's flow (`boardFlow`).
  const [flow] = useState(() => new BoardFlow());
  const flowRuntimes = boardContext?.runtimes;
  const flowServices = boardContext?.services;
  const flowScopes = boardContext?.scopes;
  useEffect(
    () =>
      flowRuntimes && flowServices && flowScopes
        ? flow.attach(flowRuntimes, flowServices, flowScopes)
        : undefined,
    [flow, flowRuntimes, flowServices, flowScopes],
  );

  // When a different board loads, prefer its facade ("App") view by default,
  // mirroring the desktop where the facade is shown first when present.
  const loadedBoardName = boardContext?.boardName;
  useEffect(() => {
    setView("facade");
  }, [loadedBoardName]);

  // Which view is shown, if the board offers more than one. Declared with the
  // other hooks, above the early return below: it must be called on every
  // render, including those where there is no board context yet.
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  if (!boardContext) {
    return null;
  }

  const { runtimes, registry, availableRuntimeEngines, facade: boardFacade, boardName } =
    boardContext;
  // One view at a time, the same as the desktop: a composition's units each
  // contribute one, and a board that is not a composition has only its own.
  const views = boardContext.linkage?.views ?? [];
  const activeView =
    views.find((v) => v.id === activeViewId) ?? views[0] ?? null;
  const facade = activeView?.facade ?? boardFacade;
  const showFacade = !!facade && view === "facade";

  const handleAddRuntime = (rtClass: RuntimeClass) => {
    boardContext.addRuntime({
      ...rtClass,
      name: `${rtClass.name} ${runtimes.length + 1}`,
    });
  };

  const handleAddService = (svc: ServiceClassWithPreset) => {
    if (!addServiceRuntime) {
      return;
    }
    const runtime = runtimes.find((rt) => rt.id === addServiceRuntime.id);
    if (runtime) {
      boardContext.addService(svc, runtime);
    }
  };

  const handleRemoveService = (
    svc: ServiceDescriptor,
    rt: RuntimeDescriptor,
  ) => {
    boardContext.removeService({ uuid: svc.uuid }, rt);
  };

  const handleRenameService = (
    runtimeId: string,
    instanceId: string,
    name: string,
  ) => {
    boardContext.setServiceName(runtimeId, instanceId, name);
  };

  const handleRemoveRuntime = (rt: RuntimeDescriptor) => {
    boardContext.removeRuntime(rt);
  };

  // What the runtime can run, with the building blocks it can hold: the
  // board's own blocks and the ones kept on this device (`core/palette`).
  const activeRegistry = addServiceRuntime
    ? paletteFor(
        registry[addServiceRuntime.id] ?? [],
        addServiceRuntime.type,
        subServicePresets,
        boardContext.linkage?.blocks?.definitions[""] ?? [],
      )
    : [];

  const canvas = (
    <div
      style={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...(showFacade
          ? {}
          : {
              backgroundImage:
                "radial-gradient(circle, #c8c0b8 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }),
      }}
    >
      {facade && <ViewToggle view={view} onChange={setView} />}

      {showFacade ? (
        <>
          {views.length > 1 && (
            <div
              role="tablist"
              style={{
                display: "flex",
                gap: 6,
                padding: "6px 10px 0",
                overflowX: "auto",
                flexShrink: 0,
                // Outside the facade, so it paints the facade's surface itself
                // — otherwise the canvas behind shows between the tabs.
                background: "hsl(var(--background, 0 0% 100%))",
              }}
            >
              {views.map((v) => (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={v.id === activeView?.id}
                  className="hkp-view-tab hkp-view-tab--touch"
                  style={{ whiteSpace: "nowrap" }}
                  onClick={() => setActiveViewId(v.id)}
                >
                  {v.title}
                </button>
              ))}
            </div>
          )}
          <MobileFacadeView
            key={activeView?.id ?? "facade"}
            facade={facade}
            boardContext={narrowBoardContext(
              boardContext,
              activeView?.runtimeIds ?? [],
            )}
            boardName={boardName ?? ""}
          />
        </>
      ) : (
        <BoardList
          onServiceTap={(svc, rt) => {
            setSelectedService(svc);
            setSelectedServiceRuntime(rt);
            onFocus?.({ runtimeId: rt.id, serviceUuids: [svc.uuid] });
          }}
          onInspect={(service, runtime) => {
            setInspected({ service, runtime });
            onFocus?.({ runtimeId: runtime.id, serviceUuids: [service.uuid] });
          }}
          activeServiceId={selectedService?.uuid ?? null}
          onAddService={(runtime) => {
            setAddServiceRuntime(runtime);
            onFocus?.({ runtimeId: runtime.id, serviceUuids: [] });
          }}
          onRemoveRuntime={handleRemoveRuntime}
          onShowAddRuntime={() => setShowAddRuntime(true)}
          structural={structural}
          onRunWith={(runtime) => {
            setRunWithRuntime(runtime);
            onFocus?.({ runtimeId: runtime.id, serviceUuids: [] });
          }}
          onMakeBlock={(runtime, uuids) => {
            setBlockOf({ runtime, uuids });
            onFocus?.({ runtimeId: runtime.id, serviceUuids: uuids });
          }}
        />
      )}

      {/* Sheets */}
      <AddRuntimeSheet
        open={showAddRuntime}
        onClose={() => setShowAddRuntime(false)}
        availableEngines={availableRuntimeEngines}
        onAdd={handleAddRuntime}
      />
      <AddServiceSheet
        open={!!addServiceRuntime && !selectedService}
        onClose={() => setAddServiceRuntime(null)}
        runtime={addServiceRuntime}
        registry={activeRegistry}
        onAdd={handleAddService}
      />
      <ServiceSheet
        open={!!selectedService}
        onClose={() => {
          setSelectedService(null);
          setSelectedServiceRuntime(null);
        }}
        service={selectedService}
        runtime={selectedServiceRuntime}
        onRemove={handleRemoveService}
        onRename={handleRenameService}
        structural={structural}
      />
      <FlowSheet
        open={!!inspected}
        onClose={() => setInspected(null)}
        service={inspected?.service ?? null}
        runtime={inspected?.runtime ?? null}
      />
      <RunSheet
        open={!!runWithRuntime}
        onClose={() => setRunWithRuntime(null)}
        target={`the first service of ${runWithRuntime?.name ?? "the runtime"}`}
        onRun={(params) => {
          if (runWithRuntime) {
            runRuntime(boardContext, runWithRuntime.id, params);
          }
          setRunWithRuntime(null);
        }}
      />
      <MakeBlockSheet
        open={!!blockOf}
        onClose={() => setBlockOf(null)}
        count={blockOf?.uuids.length ?? 0}
        initialName={
          blockOf
            ? blockNameForRun(boardContext, blockOf.runtime.id, blockOf.uuids)
            : ""
        }
        onMake={(name) => {
          if (!blockOf) {
            return;
          }
          void makeBlockOfRun(
            boardContext,
            blockOf.runtime.id,
            blockOf.uuids,
            name,
            "Building Blocks",
          ).then(() => setBlockOf(null));
        }}
      />
      {fullScreenService && (
        <FullServiceView
          service={fullScreenService.service}
          runtime={fullScreenService.runtime}
          onBack={() => setFullScreenService(null)}
        />
      )}
    </div>
  );

  return (
    <BoardFlowContext.Provider value={flow}>
      <CaptureControlContext.Provider value={capture ?? null}>
        {canvas}
      </CaptureControlContext.Provider>
    </BoardFlowContext.Provider>
  );
}
