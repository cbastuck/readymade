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
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RuntimeDescriptor } from "@/types";
import { Button } from "@/components/ui/button";

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
export default function RuntimeSettings({
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
      <DropdownMenuTrigger asChild>
        <Button className="p-0 h-min w-min" variant="ghost" size="icon">
          <Menu strokeWidth={1} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel className="capitalize font-sans tracking-wider">
          {runtime.type} Runtime
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onProcess(false)}>
            <Play className="mr-2 h-4 w-4" />
            <span>Run</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onProcess(true)}>
            <StepForward className="mr-2 h-4 w-4" />
            <span>Run with ...</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onWrapServices(!wrapServices)}>
            {wrapServices ? (
              <ArrowRightLeft className="mr-2 h-4 w-4" />
            ) : (
              <WrapText className="mr-2 h-4 w-4" />
            )}
            <span>{wrapServices ? "Unwrap Services" : "Wrap services"}</span>
          </DropdownMenuItem>

          {isExpanded ? (
            <DropdownMenuItem onClick={() => onExpand(false)}>
              <ChevronsDownUp className="mr-2 h-4 w-4" />
              <span>Collapse</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onExpand(true)}>
              <ChevronsUpDown className="mr-2 h-4 w-4" />
              <span>Expand</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onClear}>
            <Eraser className="mr-2 h-4 w-4" />
            <span>Clear</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onDelete}>
            <Trash className="mr-2 h-4 w-4" />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
