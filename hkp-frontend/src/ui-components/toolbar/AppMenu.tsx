import { useContext } from "react";
import { LogIn, LogOut, Forward, Menu, Settings, User } from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

import { AppCtx } from "@/AppContext";
import { Button } from "@/ui-components/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui-components/primitives/dropdown-menu";
import MenuIcon from "../MenuIcon";
import { useTheme } from "@/ui-components/ThemeContext";

type Props = {
  includeNavigationLinks?: boolean;
};

export default function AppMenu({ includeNavigationLinks }: Props) {
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

  const theme = useTheme();
  return (
    <div className="ml-auto">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="mt-1">
            <Menu strokeWidth={1} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-56 mx-4 font-menu"
          style={{ borderRadius: theme.borderRadius }}
        >
          {includeNavigationLinks && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="text-base"
                  onClick={() => navigate("/docs")}
                >
                  <MenuIcon icon={Forward} />
                  <span>Docs</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-base"
                  onClick={() => navigate("/home")}
                >
                  <MenuIcon icon={Forward} />
                  <span>Home</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-base"
                  onClick={() => navigate("/playground")}
                >
                  <MenuIcon icon={Forward} />
                  <span>Playground</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuGroup>
            <DropdownMenuItem
              className="text-base"
              onClick={() => (isLoggedIn ? navigate("/profile") : onLogin())}
            >
              {isLoggedIn ? (
                <>
                  <MenuIcon icon={User} />
                  <span>{nickname}</span>
                </>
              ) : (
                <>
                  <MenuIcon icon={LogIn} />
                  <span>Login</span>
                </>
              )}
            </DropdownMenuItem>

            {/*
            <DropdownMenuItem
              className="text-base"
              disabled={!isLoggedIn}
              onClick={() => navigate("/dashboard")}
            >
              <MenuIcon icon={LayoutDashboard} />
              <span>Dashboard</span>
            </DropdownMenuItem>
            */}

            <DropdownMenuItem className="text-base" disabled={true}>
              <MenuIcon icon={Settings} />
              <span>Settings</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="text-base"
            disabled={!isLoggedIn}
            onClick={onLogout}
          >
            <MenuIcon icon={LogOut} />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
