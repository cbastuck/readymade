import { Ellipsis, Trash } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui-components/primitives/dropdown-menu";
import { Button } from "@/ui-components/primitives/button";

import { SavedBoard } from "@/types";
import MenuIcon from "../MenuIcon";
import { AdditionalActionItem } from ".";

type Props = {
  board: SavedBoard;
  additionalActions: Array<AdditionalActionItem>;
  onAction: (board: SavedBoard, action: any) => void;
};

export default function BoardActionButton({
  board,
  additionalActions,
  onAction,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="p-0 h-min w-min" variant="ghost" size="icon">
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 font-menu">
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="text-base"
            onClick={() => onAction(board, { command: "delete" })}
          >
            <MenuIcon icon={Trash} />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {additionalActions && (
          <DropdownMenuGroup>
            {additionalActions.map((actionItem: AdditionalActionItem) => (
              <DropdownMenuItem
                key={actionItem.value}
                className="text-base"
                onClick={() => onAction(board, { command: actionItem.value })}
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
