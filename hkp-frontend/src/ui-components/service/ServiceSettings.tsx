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
import { useThemeControl } from "hkp-frontend/src/ui-components/ThemeContext";

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

function DragHandle() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2.5, padding: 2, opacity: 0.3, cursor: "grab" }}>
      <span style={{ display: "block", width: 11, height: 1.5, background: "var(--text, #1a1a1a)", borderRadius: 2 }} />
      <span style={{ display: "block", width: 11, height: 1.5, background: "var(--text, #1a1a1a)", borderRadius: 2 }} />
      <span style={{ display: "block", width: 11, height: 1.5, background: "var(--text, #1a1a1a)", borderRadius: 2 }} />
    </div>
  );
}

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
  const { themeName } = useThemeControl();
  const isPlayground = themeName === "playground";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {isPlayground ? (
          <button
            type="button"
            title="Service options"
            className="bg-transparent border-none p-0 cursor-pointer flex items-center rounded flex-shrink-0"
            onMouseEnter={(e) => {
              (e.currentTarget.firstChild as HTMLElement).style.opacity = "0.6";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget.firstChild as HTMLElement).style.opacity = "0.3";
            }}
          >
            <DragHandle />
          </button>
        ) : (
          <Button className="p-4 h-min w-min" variant="ghost" size="icon">
            <Menu strokeWidth={1} />
          </Button>
        )}
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
