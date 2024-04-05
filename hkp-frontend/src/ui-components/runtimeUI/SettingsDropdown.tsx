import {
  Play,
  Trash,
  Eraser,
  WrapText,
  ChevronsDownUp,
  ChevronsUpDown,
  StepForward,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { RuntimeDescriptor } from "@/types";
import DropdownTrigger from "@/ui-components/DropdownTrigger";

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
};
export default function SettingsDropdown({
  runtime,
  isExpanded,
  wrapServices,
  onExpand,
  onWrapServices,
  onClear,
  onDelete,
  onProcess,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownTrigger />
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel className="capitalize">
          {runtime.type} Runtime
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onProcess(false)}>
            <Play className="mr-2 h-4 w-4" />
            <span>Run</span>
            <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onProcess(true)}>
            <StepForward className="mr-2 h-4 w-4" />
            <span>Run with ...</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onClear}>
            <Eraser className="mr-2 h-4 w-4" />
            <span>Clear</span>
            <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onDelete}>
            <Trash className="mr-2 h-4 w-4" />
            <span>Delete</span>
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => onWrapServices(!wrapServices)}>
            <WrapText className="mr-2 h-4 w-4" />
            <span>Wrap Services</span>
            <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
          </DropdownMenuItem>

          {isExpanded ? (
            <DropdownMenuItem onClick={() => onExpand(false)}>
              <ChevronsDownUp className="mr-2 h-4 w-4" />
              <span>Collapse</span>
              <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onExpand(true)}>
              <ChevronsUpDown className="mr-2 h-4 w-4" />
              <span>Expand</span>
              <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
