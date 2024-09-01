import { Menu, Trash2 } from "lucide-react";
import MenuIcon from "@/ui-components/MenuIcon";
import Icon from "@/ui-components/Icon";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/ui-components/primitives/dropdown-menu";
import { Button } from "@/ui-components/primitives/button";

type Props = {
  onRemoveWidget?: () => void;
};

export default function BoardWidgetSettings({ onRemoveWidget }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="p-0 h-min w-min" variant="ghost" size="icon">
          <Icon className="mt-0.5" value={Menu} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 font-menu">
        <DropdownMenuItem className="text-base" onClick={onRemoveWidget}>
          <MenuIcon icon={Trash2} />
          <span>Remove Widget from Home</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
