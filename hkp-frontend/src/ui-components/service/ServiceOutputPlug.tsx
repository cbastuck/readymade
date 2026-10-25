import { ReactNode, useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Pin, PinOff, Maximize, Minimize } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "hkp-frontend/src/ui-components/primitives/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "hkp-frontend/src/ui-components/primitives/context-menu";

import { isTooLarge } from "hkp-frontend/src/runtime/callReport";
import { isCapturing, setCapturing } from "hkp-frontend/src/runtime/captureMode";
import { useTheme } from "../ThemeContext";
import FlowInspectorPopup from "./FlowInspectorPopup";
import FlowWaveIcon from "./FlowWaveIcon";
import "../settings/settings.css";
import "./flow-inspector.css";

/** One value a service received or produced, and when (ms since epoch). */
export type FlowRecord = { data: any; at: number };

/** Which way through the service a value went. */
export type FlowSide = "input" | "output";

type Props = {
  isActive?: boolean;
  /** What the service was called with and what it produced, newest first;
   *  see `rememberFlow`. A service emitting on its own receives nothing. */
  inputHistory: FlowRecord[];
  outputHistory: FlowRecord[];
  onClearHistory: (side: FlowSide) => void;
  /** Carries an output on downstream, as if the service had produced it. */
  onInject: (data: any) => void;
  /** Runs the service again with an input; absent where its runtime cannot. */
  onRerun?: (input: any) => void;
  /**
   * How far the plug sits below the top of what it is drawn beside — a
   * service card's header by default; none beside a use's bar, which it is
   * centred on.
   */
  offsetTop?: number;
};

// Sizing inline rather than through utilities: it has to beat the primitive's
// own classes whatever order the stylesheets load in.
const frameStyle: React.CSSProperties = {
  width: "min(460px, 94vw)",
  // No taller than the room the popover was placed in: the body scrolls, and
  // the header — Close among it — and the footer stay on screen.
  maxHeight: "var(--radix-popover-content-available-height)",
  display: "flex",
  flexDirection: "column",
  padding: 0,
  borderRadius: 14,
  overflow: "hidden",
};

/** Space kept free around the popover, so it is never placed against an edge. */
const EDGE = 8;

/**
 * How far down the toolbar reaches. It stays at the top of the page above
 * everything (z-index 100), so a popover placed under it has a header nobody
 * can reach; the edge is read when the popover opens, because the host decides
 * what sits above the bar.
 */
function toolbarBottom(): number {
  const toolbar = document.querySelector("[data-toolbar]");
  return toolbar ? Math.max(0, toolbar.getBoundingClientRect().bottom) : 0;
}

// The expanded inspector: the size of the other editor dialogs, the editor
// taking what the history leaves.
const expandedFrameStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "min(1280px, 92vw)",
  maxWidth: "none",
  height: "min(900px, 86vh)",
  padding: 0,
  gap: 0,
  overflow: "hidden",
  borderRadius: 16,
};

const MAX_HISTORY = 10;

// Typed Data objects (FloatRingBuffer etc.) carry a Symbol tag, which
// structuredClone rejects with DataCloneError — keep the reference instead.
function safeClone(data: any): any {
  try {
    return structuredClone(data);
  } catch (_err) {
    return data;
  }
}

/**
 * `history` with `data` as its newest value, arrived `at`, keeping the last
 * MAX_HISTORY.
 *
 * Meant for a functional state update where each value arrives: values
 * reported in quick succession — an Iterator's items — are rendered once, so
 * a history built from a prop's changes would keep only the last of them.
 */
export function rememberFlow(
  history: FlowRecord[],
  data: any,
  at: number = Date.now(),
): FlowRecord[] {
  return [{ data: safeClone(data), at }, ...history].slice(0, MAX_HISTORY);
}

export default function ServiceOutputPlug({
  isActive,
  inputHistory,
  outputHistory,
  onClearHistory,
  onInject,
  onRerun,
  offsetTop = 18,
}: Props) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clearTop, setClearTop] = useState(0);
  // What the service produced, unless asked for what it received.
  const [side, setSide] = useState<FlowSide>("output");
  // Which remembered value is shown on each side, 0 being the latest; the
  // popover and the expanded view share it.
  const [selected, setSelected] = useState({ input: 0, output: 0 });
  // The history list starts folded away, and stays as it was left while the
  // service is on screen.
  const [historyExpanded, setHistoryExpanded] = useState(false);
  // Opening the inspector without Capture mode asks first: what it would show
  // is only that the service ran, which is worth knowing before looking.
  const [askingToCapture, setAskingToCapture] = useState(false);

  // A new value is the one shown on its side.
  useEffect(() => {
    setSelected((s) => ({ ...s, input: 0 }));
  }, [inputHistory[0]]);
  useEffect(() => {
    setSelected((s) => ({ ...s, output: 0 }));
  }, [outputHistory[0]]);

  const history = side === "input" ? inputHistory : outputHistory;
  const selectedIndex = selected[side];

  const openInspector = () => {
    setClearTop(toolbarBottom());
    setIsOpen(true);
  };
  const onOpen = () => {
    if (isCapturing()) {
      openInspector();
    } else {
      setAskingToCapture(true);
    }
  };
  // Either answer opens it: with the values from the next run on, or with the
  // activity it has.
  const onAnswerCapture = (capture: boolean) => {
    setAskingToCapture(false);
    if (capture) {
      setCapturing(true);
    }
    openInspector();
  };

  const onClose = () => {
    setIsOpen(false);
    setIsSticky(false);
    setIsFullscreen(false);
  };
  const onSticky = () => setIsSticky(!isSticky);
  const onMaximize = () => setIsFullscreen(true);

  const sideSwitch = (
    <div className="hkp-flow-sides" role="group" aria-label="Side">
      {(["input", "output"] as const).map((each) => (
        <button
          key={each}
          type="button"
          aria-pressed={side === each}
          onClick={() => setSide(each)}
        >
          {each === "input" ? "Input" : "Output"}
        </button>
      ))}
    </div>
  );

  // The same inspector in the popover and expanded: the history, the shown
  // value and what can be done with it.
  const inspector = (
    <FlowInspectorPopup
      key={side}
      side={side}
      history={history}
      selectedIndex={selectedIndex}
      onSelectIndex={(index) => setSelected((s) => ({ ...s, [side]: index }))}
      onRun={side === "input" ? onRerun : onInject}
      onClearHistory={() => onClearHistory(side)}
      historyExpanded={historyExpanded}
      onToggleHistory={() => setHistoryExpanded((expanded) => !expanded)}
    />
  );

  if (isFullscreen) {
    // Room in the header for the buttons the dialog draws at its right.
    const headerPaddingRight = 56 + 32;
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="hkp-set hkp-set-dialog"
          style={expandedFrameStyle}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          additionalHeaderButtons={[
            <ToolButton
              key="minimize"
              label="Back to popover"
              onClick={() => setIsFullscreen(false)}
            >
              <Minimize size={16} />
            </ToolButton>,
          ]}
        >
          <div
            className="hkp-flow-header"
            style={{ paddingRight: headerPaddingRight }}
          >
            <DialogPrimitive.Title className="hkp-set-pane-title hkp-flow-title">
              Flow Inspector
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              What the service received and produced
            </DialogPrimitive.Description>
            {sideSwitch}
          </div>
          <div className="hkp-flow-fill">{inspector}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={(newOpen) => !isSticky && !newOpen && onClose()}
    >
      <ContextMenu>
        <ContextMenuTrigger>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Inspect input and output"
              style={{
                marginTop: offsetTop,
                marginLeft: 4,
                // Above the drop zone a pipeline lays along each service's
                // right edge (ServiceWithDropBars, z-index 20), which would
                // otherwise take the clicks on the plug's last third.
                position: "relative",
                zIndex: 21,
              }}
              onClick={onOpen}
            >
              <FlowWaveIcon
                isActive={!!isActive}
                accentColor={theme.accentColor}
              />
            </button>
          </PopoverTrigger>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            disabled={
              !onRerun ||
              inputHistory.length === 0 ||
              isTooLarge(inputHistory[0].data)
            }
            onSelect={() => onRerun?.(inputHistory[0].data)}
          >
            Rerun with the last input
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <PopoverContent
        className="hkp-set hkp-flow-popover"
        style={frameStyle}
        collisionPadding={{
          top: clearTop + EDGE,
          right: EDGE,
          bottom: EDGE,
          left: EDGE,
        }}
      >
        <div className="hkp-flow-header">
          <h2 className="hkp-set-pane-title hkp-flow-title">Flow Inspector</h2>
          {sideSwitch}
          <div className="hkp-flow-tools">
            <ToolButton label="Expand" onClick={onMaximize}>
              <Maximize size={15} />
            </ToolButton>
            <ToolButton
              label={isSticky ? "Unpin" : "Keep open"}
              pressed={isSticky}
              onClick={onSticky}
            >
              {isSticky ? <PinOff size={15} /> : <Pin size={15} />}
            </ToolButton>
            <ToolButton label="Close" onClick={onClose}>
              <X size={16} />
            </ToolButton>
          </div>
        </div>

        {inspector}
      </PopoverContent>

      <Dialog
        open={askingToCapture}
        onOpenChange={(open) => !open && setAskingToCapture(false)}
      >
        <DialogContent className="max-w-md w-[92vw]">
          <DialogHeader>
            <DialogTitle>Capture mode is off</DialogTitle>
            <DialogDescription>
              Capture mode is off, so the inspector shows that this service
              ran, but not what it received or passed on. Turn Capture mode
              on? It takes effect from the next run.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => onAnswerCapture(false)}>
              Not now
            </Button>
            <Button size="sm" onClick={() => onAnswerCapture(true)}>
              Turn on Capture mode
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Popover>
  );
}

function ToolButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="hkp-set-icon-btn hkp-set-icon-btn--neutral"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
