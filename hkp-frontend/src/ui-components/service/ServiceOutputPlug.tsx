import { ReactNode, useEffect, useState } from "react";

const MAX_HISTORY = 10;
import { X, Pin, PinOff, Maximize, Minimize } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "hkp-frontend/src/ui-components/primitives/popover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "hkp-frontend/src/ui-components/primitives/context-menu";

import { useTheme } from "../ThemeContext";
import FlowInspectorPopup from "./FlowInspectorPopup";
import FlowWaveIcon from "./FlowWaveIcon";
import "../settings/settings.css";
import "./flow-inspector.css";

import EditorDialog from "../EditorDialog";

type Props = {
  isActive?: boolean;
  data: any;
  onInject: (data: any) => void;
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
  padding: 0,
  borderRadius: 14,
  overflow: "hidden",
};

// Typed Data objects (FloatRingBuffer etc.) carry a Symbol tag, which
// structuredClone rejects with DataCloneError — keep the reference instead.
function safeClone(data: any): any {
  try {
    return structuredClone(data);
  } catch (_err) {
    return data;
  }
}

export default function ServiceOutputPlug({
  isActive,
  data,
  onInject,
  offsetTop = 18,
}: Props) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Which remembered output is shown, 0 being the latest; the popover and the
  // expanded view share it.
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [history, setHistory] = useState<any[]>(() =>
    data != null ? [safeClone(data)] : [],
  );

  useEffect(() => {
    if (data == null) {
      return;
    }
    setHistory((prev) => [safeClone(data), ...prev].slice(0, MAX_HISTORY));
    setSelectedIndex(0);
  }, [data]);

  const onOpen = () => setIsOpen(true);

  const onClose = () => {
    setIsOpen(false);
    setIsSticky(false);
    setIsFullscreen(false);
  };
  const onSticky = () => setIsSticky(!isSticky);
  const onMaximize = () => setIsFullscreen(true);

  if (isFullscreen) {
    return (
      <EditorDialog
        title="Flow Inspector"
        isOpen={true}
        value={history[selectedIndex]}
        additionalHeaderButtons={[
          <ToolButton
            label="Back to popover"
            onClick={() => setIsFullscreen(false)}
          >
            <Minimize size={16} />
          </ToolButton>,
        ]}
        onClose={onClose}
      />
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
              aria-label="Inspect output"
              style={{
                marginTop: offsetTop,
                marginLeft: 4,
                zIndex: 1,
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
          <ContextMenuItem disabled={!data}>Rerun</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <PopoverContent className="hkp-set" style={frameStyle}>
        <div className="hkp-flow-header">
          <h2 className="hkp-set-pane-title hkp-flow-title">Flow Inspector</h2>
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

        <FlowInspectorPopup
          history={history}
          selectedIndex={selectedIndex}
          onSelectIndex={setSelectedIndex}
          onInject={onInject}
        />
      </PopoverContent>
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
