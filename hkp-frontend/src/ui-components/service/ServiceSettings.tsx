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
} from "hkp-frontend/src/ui-components/primitives/dropdown-menu";
import { CustomMenuEntry, ServiceDescriptor } from "hkp-frontend/src/types";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import MenuIcon from "../MenuIcon";

type Props = {
  service: ServiceDescriptor;
  isCollapsed: boolean;
  customMenuEntries?: Array<CustomMenuEntry>;
  onExpand: (expanded: boolean) => void;
  onDelete: () => void;
  onHelp: () => void;
  onConfig: () => void;
  onCustomEntry: (item: CustomMenuEntry) => void;
};
export default function ServiceSettings({
  isCollapsed,
  service,
  customMenuEntries,
  onHelp,
  onExpand,
  onDelete,
  onConfig,
  onCustomEntry,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="p-4 h-min w-min" variant="ghost" size="icon">
          <Menu strokeWidth={1} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 font-menu">
        <DropdownMenuLabel className="capitalize font-sans tracking-wider text-base">
          {service.serviceName} Service
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onConfig} className="text-base">
          <MenuIcon icon={FileCog} />
          <span>Configuration</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {!isCollapsed ? (
          <DropdownMenuItem
            onClick={() => onExpand(false)}
            className="text-base"
          >
            <MenuIcon icon={ChevronsDownUp} />
            <span>Collapse</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => onExpand(true)}
            className="text-base"
          >
            <MenuIcon icon={ChevronsUpDown} />
            <span>Expand</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={onHelp}
          className="text-base"
          disabled={true}
        >
          <MenuIcon icon={Info} />
          <span>Documentation</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-base">
          <MenuIcon icon={Trash} />
          <span>Delete</span>
        </DropdownMenuItem>

        {customMenuEntries && (
          <>
            <DropdownMenuSeparator />
            {customMenuEntries.map((item: CustomMenuEntry) => (
              <DropdownMenuItem
                className="text-base"
                key={item.name}
                onClick={() => onCustomEntry(item)}
                disabled={item.disabled}
              >
                {item.icon || null}
                <span>{item.name}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
