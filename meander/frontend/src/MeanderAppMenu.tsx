import { Menu, Palette } from "lucide-react";

import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "hkp-frontend/src/ui-components/primitives/dropdown-menu";
import {
  ThemeName,
  useThemeControl,
} from "hkp-frontend/src/ui-components/ThemeContext";

export default function MeanderAppMenu() {
  const { themeName, setThemeName } = useThemeControl();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="ml-auto">
        <Button variant="ghost">
          <Menu strokeWidth={1} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48 mx-4">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-base">
            <Palette size={16} className="mr-2" />
            <span>Theme</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={themeName}
              onValueChange={(v) => setThemeName(v as ThemeName)}
            >
              <DropdownMenuRadioItem value="default">Default</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="sketch">Sketch</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
