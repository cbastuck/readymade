import { useContext } from "react";
import {
  LogIn,
  LogOut,
  Forward,
  Menu,
  Settings,
  LayoutDashboard,
  User,
} from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router-dom";

import { AppCtx } from "@/AppContext";
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

type Props = {
  isCompact: boolean;
};

export default function AppMenu({ isCompact }: Props) {
  const { loginWithRedirect, logout } = useAuth0();
  const context = useContext(AppCtx);
  const currentUser = context?.user;

  const isLoggedIn = !!currentUser;
  const nickname = currentUser?.username;

  const onLogin = async () => {
    if (!isLoggedIn) {
      await loginWithRedirect({
        appState: {
          returnTo: window.location.href,
        },
      });
    }
  };

  const onLogout = async () => {
    await logout({
      openUrl: () => {
        if (context) {
          context.logout();
        }
      },
    });
  };

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
        {isCompact && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Forward className="mr-2 h-4 w-4" />
                <Link to="/docs">Docs</Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Forward className="mr-2 h-4 w-4" />
                <Link to="/examples">Examples</Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Forward className="mr-2 h-4 w-4" />
                <Link to="/playground">Playground</Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onLogin}>
            {isLoggedIn ? (
              <>
                <User className="mr-2 h-4 w-4" />
                <Link to="/profile">Profile</Link>
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
            <Link to="/dashboard">Dashboard</Link>
          </DropdownMenuItem>

          <DropdownMenuItem disabled={true}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled={!isLoggedIn} onClick={onLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
