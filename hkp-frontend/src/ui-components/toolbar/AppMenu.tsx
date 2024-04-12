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
import { useNavigate } from "react-router-dom";

import { AppCtx } from "@/AppContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
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
  const navigate = useNavigate();

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
        {isCompact && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate("/docs")}>
                <Forward className="mr-2 h-4 w-4" />
                <span>Docs</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/examples")}>
                <Forward className="mr-2 h-4 w-4" />
                <span>Examples</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/playground")}>
                <Forward className="mr-2 h-4 w-4" />
                <span>Playground</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => (isLoggedIn ? navigate("/profile") : onLogin())}
          >
            {isLoggedIn ? (
              <>
                <User className="mr-2 h-4 w-4" />
                <span>{nickname}</span>
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                <span>Login</span>
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={!isLoggedIn}
            onClick={() => navigate("/dashboard")}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
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
