import { Ellipsis, Trash } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui-components/primitives/dropdown-menu";
import { Button } from "@/ui-components/primitives/button";

import { SavedBoard } from "@/types";
import MenuIcon from "../MenuIcon";

type Props = {
  board: SavedBoard;
  onAction: (board: SavedBoard, action: any) => void;
};

export default function BoardActionButton({ board, onAction }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="p-0 h-min w-min" variant="ghost" size="icon">
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 font-menu">
        <DropdownMenuLabel className="text-base capitalize font-sans tracking-wider">
          Saved Board Actions
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="text-base"
            onClick={() => onAction(board, { command: "delete" })}
          >
            <MenuIcon icon={Trash} />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
