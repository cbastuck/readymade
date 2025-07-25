import {
  Play,
  Trash,
  Eraser,
  WrapText,
  ChevronsDownUp,
  ChevronsUpDown,
  StepForward,
  ArrowRightLeft,
  Menu,
  Settings,
  Save,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "hkp-frontend/src/ui-components/primitives/dropdown-menu";
import { RuntimeDescriptor } from "hkp-frontend/src/types";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import MenuIcon from "../MenuIcon";

type Props = {
  isExpanded?: boolean;
  wrapServices?: boolean;
  disabledItems?: Array<string>;
  runtime: RuntimeDescriptor;
  onExpand: (isExpanded: boolean) => void;
  onWrapServices: (isWrapped: boolean) => void;
  onProcess: (withParams?: boolean) => void;
  onClear: () => void;
  onDelete: () => void;
  onConfiguration: () => void;
  onSave: () => void;
};
export default function RuntimeSettings({
  runtime,
  isExpanded,
  wrapServices,
  onExpand,
  onWrapServices,
  onClear,
  onDelete,
  onProcess,
  onConfiguration,
  onSave,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="p-0 h-min w-min"
          variant="ghost"
          size="icon"
          aria-label={`runtime-settings-${runtime.id}`}
        >
          <Menu strokeWidth={1} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 font-menu">
        <DropdownMenuLabel className="text-base capitalize font-sans tracking-wider">
          {runtime.type} Runtime
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="text-base"
            onClick={() => onProcess(false)}
          >
            <MenuIcon icon={Play} />
            <span>Run</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-base"
            onClick={() => onProcess(true)}
          >
            <MenuIcon icon={StepForward} />
            <span>Run with ...</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="text-base"
            onClick={() => onWrapServices(!wrapServices)}
          >
            {wrapServices ? (
              <MenuIcon icon={ArrowRightLeft} />
            ) : (
              <MenuIcon icon={WrapText} />
            )}
            <span>{wrapServices ? "Unwrap Services" : "Wrap services"}</span>
          </DropdownMenuItem>

          {isExpanded ? (
            <DropdownMenuItem
              className="text-base"
              onClick={() => onExpand(false)}
            >
              <MenuIcon icon={ChevronsDownUp} />
              <span>Collapse</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="text-base"
              onClick={() => onExpand(true)}
            >
              <MenuIcon icon={ChevronsUpDown} />
              <span>Expand</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="text-base" onClick={onConfiguration}>
            <MenuIcon icon={Settings} />
            <span>Configuration</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-base" onClick={onClear}>
            <MenuIcon icon={Eraser} />
            <span>Clear</span>
          </DropdownMenuItem>

          <DropdownMenuItem className="text-base" onClick={onDelete}>
            <MenuIcon icon={Trash} />
            <span>Delete</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-base" onClick={onSave}>
            <MenuIcon icon={Save} />
            <span>Save to Disk</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
