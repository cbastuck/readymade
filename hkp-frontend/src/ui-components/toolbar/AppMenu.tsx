import { useContext } from "react";
import {
  LogIn,
  LogOut,
  Forward,
  Menu,
  Settings,
  User,
  Server,
} from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

import { AppCtx } from "hkp-frontend/src/AppContext";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "hkp-frontend/src/ui-components/primitives/dropdown-menu";
import MenuIcon from "../MenuIcon";
import { useTheme } from "hkp-frontend/src/ui-components/ThemeContext";

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
      logoutParams: {
        returnTo: `${window.location.protocol}//${window.location.host}/logout`,
      },
    });
  };

  const theme = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="ml-auto">
        <Button variant="ghost">
          <Menu strokeWidth={1} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 mx-4 font-menu"
        style={{ borderRadius: theme.borderRadius }}
      >
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="text-base"
            onClick={() => navigate("/remotes")}
          >
            <MenuIcon icon={Server} />
            <span>Remotes</span>
          </DropdownMenuItem>
          {includeNavigationLinks && (
            <>
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
            </>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

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
  );
}
