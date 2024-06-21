import { useState } from "react";
import { X, Pin, PinOff } from "lucide-react";

import Wire from "@/assets/plug.svg?react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui-components/primitives/popover";

import { useTheme } from "../ThemeContext";
import FlowInspectorPopup from "./FlowInspectorPopup";

import Button from "../Button";

type Props = {
  isActive?: boolean;
  data: any;
  onInject: (data: any) => void;
};

export default function ServiceOutputPlug({ isActive, data, onInject }: Props) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isSticky, setIsSticky] = useState(false);

  const onOpen = () => setIsOpen(true);

  const onClose = () => {
    setIsOpen(false);
    setIsSticky(false);
  };
  const onSticky = () => setIsSticky(!isSticky);

  return (
    <div
      style={{
        position: "absolute",
        top: "20px",
        right: "-20px",
        cursor: "pointer",
      }}
    >
      <Popover
        open={isOpen}
        onOpenChange={(newOpen) => !isSticky && !newOpen && onClose()}
      >
        <PopoverTrigger asChild>
          <button onClick={onOpen}>
            <Wire
              width="20px"
              style={{ paddingLeft: 3 }}
              strokeWidth="10px"
              stroke={isActive ? theme.accentColor : theme.borderColor}
              fill={isActive ? theme.accentColor : "white"}
              className="hover:stroke-[#666]"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[450px]">
          <div className="flex items-center">
            <h2 className="font-medium leading-none w-full text-left">
              Flow Inspector
            </h2>
            <div className="flex">
              <StickyButton isSticky={isSticky} onClick={onSticky} />
              <CloseButton onClick={onClose} />
            </div>
          </div>

          <FlowInspectorPopup data={data} onInject={onInject} />
        </PopoverContent>
      </Popover>
    </div>
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
