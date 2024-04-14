import {
  ChevronsDownUp,
  ChevronsUpDown,
  Info,
  Menu,
  Trash,
  FileCog,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ServiceDescriptor } from "@/types";
import { Button } from "@/components/ui/button";

type Props = {
  service: ServiceDescriptor;
  isCollapsed: boolean;
  onExpand: (expanded: boolean) => void;
  onDelete: () => void;
  onHelp: () => void;
  onConfig: () => void;
};
export default function ServiceSettings({
  isCollapsed,
  service,
  onHelp,
  onExpand,
  onDelete,
  onConfig,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="p-4 h-min w-min" variant="ghost" size="icon">
          <Menu strokeWidth={1} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel className="capitalize font-sans tracking-wider">
          {service.serviceName} Service
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onConfig}>
          <FileCog className="mr-2 h-4 w-4" />
          <span>Config</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {!isCollapsed ? (
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
        <DropdownMenuItem onClick={onHelp}>
          <Info className="mr-2 h-4 w-4" />
          <span>Documentation</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete}>
          <Trash className="mr-2 h-4 w-4" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
