import {
  LogIn,
  LogOut,
  Menu,
  Settings,
  LayoutDashboard,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function DropdownMenuDemo() {
  const isLoggedIn = false;
  const nickname = "cba";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">
          <Menu strokeWidth={1} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 mx-[10px]">
        {isLoggedIn ? (
          <>
            <DropdownMenuLabel>{nickname} </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuGroup>
          <DropdownMenuItem>
            {isLoggedIn ? (
              <>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                <span>Login</span>
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem disabled={!isLoggedIn}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </DropdownMenuItem>

          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled={!isLoggedIn}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
