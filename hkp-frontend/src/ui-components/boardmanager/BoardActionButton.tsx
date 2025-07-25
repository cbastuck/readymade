import { Ellipsis } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "hkp-frontend/src/ui-components/primitives/dropdown-menu";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";

import { SavedBoard } from "hkp-frontend/src/types";
import MenuIcon from "../MenuIcon";
import { ActionItem } from ".";

type Props = {
  board: SavedBoard;
  actions: Array<ActionItem>;
  onAction?: (board: SavedBoard, action: any) => void;
};

export default function BoardActionButton({ board, actions, onAction }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="p-0 h-min w-min" variant="ghost" size="icon">
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 font-menu">
        {actions && (
          <DropdownMenuGroup>
            {actions.map((actionItem: ActionItem) => (
              <DropdownMenuItem
                key={actionItem.value}
                className="text-base"
                onClick={() => onAction?.(board, { command: actionItem.value })}
              >
                <MenuIcon icon={actionItem.icon} />
                <span>{actionItem.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
