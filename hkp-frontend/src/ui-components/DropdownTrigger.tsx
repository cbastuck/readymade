import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function DropdownTrigger() {
  return (
    <DropdownMenuTrigger asChild>
      <Button className="p-0 h-min w-min" variant="ghost" size="icon">
        <Menu strokeWidth={1} />
      </Button>
    </DropdownMenuTrigger>
  );
}
