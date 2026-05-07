import { useState } from "react";
import { X, Pin, PinOff, Maximize } from "lucide-react";

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

import Button from "../Button";
import EditorDialog from "../EditorDialog";

type Props = {
  isActive?: boolean;
  data: any;
  onInject: (data: any) => void;
};

export default function ServiceOutputPlug({ isActive, data, onInject }: Props) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
        value={data}
        additionalHeaderButtons={[
          <MaximizeButton
            variant="ghost"
            active={true}
            onClick={() => setIsFullscreen(false)}
          />,
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
              style={{
                marginTop: 18,
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

      <PopoverContent className="w-[450px]">
        <div className="flex items-center">
          <h2 className="font-medium leading-none w-full text-left">
            Flow Inspector
          </h2>
          <div className="flex">
            <MaximizeButton onClick={onMaximize} />
            <StickyButton isSticky={isSticky} onClick={onSticky} />
            <CloseButton onClick={onClose} />
          </div>
        </div>

        <FlowInspectorPopup data={data} onInject={onInject} />
      </PopoverContent>
    </Popover>
  );
}

function CloseButton({ onClick }: any) {
  return (
    <div className="text-right">
      <Button className="w-9 p-2 m-0" onClick={onClick}>
        <X />
      </Button>
    </div>
  );
}

function MaximizeButton({ onClick, variant = "outline", active = false }: any) {
  return (
    <div className="text-right">
      <Button className="w-9 p-2 m-0" variant={variant} onClick={onClick}>
        <Maximize className={active ? "stroke-sky-600" : "currentColor"} />
      </Button>
    </div>
  );
}

function StickyButton({ isSticky, onClick }: any) {
  const theme = useTheme();
  return (
    <div className="text-right">
      <Button
        className="w-9 p-2 m-0"
        style={{ backgroundColor: isSticky ? theme.accentColor : undefined }}
        onClick={onClick}
      >
        {isSticky ? <PinOff /> : <Pin />}
      </Button>
    </div>
  );
}
