import { useContext, useState } from "react";
import { LogIn, LogOut, Menu, Settings, User } from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";

import { AppCtx } from "hkp-frontend/src/AppContext";
import { useCloudLogin } from "hkp-frontend/src/auth/useCloudLogin";
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
import SettingsDialog, {
  APPEARANCE_TAB,
} from "hkp-frontend/src/ui-components/SettingsDialog";
import AccountDialog from "hkp-frontend/src/views/profile/AccountDialog";
import {
  useTheme,
  useThemeControl,
} from "hkp-frontend/src/ui-components/ThemeContext";

export default function AppMenu() {
  const { logout } = useAuth0();
  // The shared trigger rather than a redirect of its own: it signs in through a
  // popup where a redirect would discard the board on the page, and it defers to
  // a host that owns its own login (the native app, whose webview a redirect
  // would navigate away from).
  const cloudLogin = useCloudLogin();
  const context = useContext(AppCtx);
  const currentUser = context?.user;
  const [settingsTab, setSettingsTab] = useState<string | null>(null);
  // Over whatever is showing, not in place of it: this menu sits in a board's
  // toolbar, and a board is live state that a replaced view would discard.
  const [isAccountOpen, setAccountOpen] = useState(false);

  const isLoggedIn = !!currentUser;
  const nickname = currentUser?.username;

  const onLogin = async () => {
    if (!isLoggedIn) {
      await cloudLogin();
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
  const { themeName } = useThemeControl();
  const isPlayground = themeName === "playground";
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild className="ml-auto">
          <div className="px-4">
            <Button
              variant="ghost"
              style={
                isPlayground
                  ? {
                      width: 30,
                      height: 30,
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 6,
                      color: "var(--text-dim)",
                    }
                  : undefined
              }
            >
              <Menu strokeWidth={1} />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-56 mx-4 font-menu"
          style={{ borderRadius: theme.borderRadius }}
        >
          <DropdownMenuItem
            className="text-base"
            onSelect={() => setSettingsTab(APPEARANCE_TAB)}
          >
            <MenuIcon icon={Settings} />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="text-base"
              onClick={() => (isLoggedIn ? setAccountOpen(true) : onLogin())}
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
            <DropdownMenuSeparator />

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

      <SettingsDialog tab={settingsTab} onChangeTab={setSettingsTab} />
      <AccountDialog open={isAccountOpen} onOpenChange={setAccountOpen} />
    </>
  );
}
