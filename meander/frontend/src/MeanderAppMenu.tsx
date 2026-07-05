import { useState } from "react";
import { LogIn, LogOut, Menu, Settings } from "lucide-react";

import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import { useAppContext } from "hkp-frontend/src/AppContext";
import { useCloudLogin } from "hkp-frontend/src/auth/useCloudLogin";
import { useCloudLogout } from "hkp-frontend/src/auth/useCloudLogout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "hkp-frontend/src/ui-components/primitives/dropdown-menu";

import MeanderSettingsDialog from "./MeanderSettingsDialog";

export default function MeanderAppMenu() {
  const { user } = useAppContext();
  const cloudLogin = useCloudLogin();
  const cloudLogout = useCloudLogout();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild className="ml-auto">
          <Button variant="ghost">
            <Menu strokeWidth={1} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48 mx-4">
          {user ? (
            <DropdownMenuItem
              className="text-base"
              onSelect={() => void cloudLogout()}
            >
              <LogOut size={16} className="mr-2" />
              <span>
                {user.username ? `Log out (${user.username})` : "Log out"}
              </span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="text-base"
              onSelect={() => void cloudLogin()}
            >
              <LogIn size={16} className="mr-2" />
              <span>Login</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-base"
            onSelect={() => setIsSettingsOpen(true)}
          >
            <Settings size={16} className="mr-2" />
            <span>Settings</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MeanderSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </>
  );
}
