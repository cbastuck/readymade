import { useCallback, useEffect, useState } from "react";
import { LogIn, LogOut, Menu, Palette, Search, Settings } from "lucide-react";

import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import { useAppContext } from "hkp-frontend/src/AppContext";
import { useCloudLogin } from "hkp-frontend/src/auth/useCloudLogin";
import { useCloudLogout } from "hkp-frontend/src/auth/useCloudLogout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "hkp-frontend/src/ui-components/primitives/dropdown-menu";
import {
  ThemeName,
  useThemeControl,
} from "hkp-frontend/src/ui-components/ThemeContext";
import { useBoardContext } from "hkp-frontend/src/BoardContext";
import {
  isRuntimeGraphQLClassType,
  isRuntimeRestClassType,
  RuntimeClass,
} from "hkp-frontend/src/types";
import { isDiscoverySupported } from "hkp-frontend/src/runtime/discovery/DiscoveryApi";
import ManageRuntimesDialog from "hkp-frontend/src/ui-components/toolbar/ManageRuntimesDialog";

import { deleteRemote, getRemotes, saveRemote } from "./actions";
import { Remote } from "./types";
import MeanderSettingsDialog from "./MeanderSettingsDialog";

const isRemoteRuntime = (rt: RuntimeClass) =>
  isRuntimeGraphQLClassType(rt.type) || isRuntimeRestClassType(rt.type);

export default function MeanderAppMenu() {
  const { themeName, setThemeName } = useThemeControl();
  const { user } = useAppContext();
  const cloudLogin = useCloudLogin();
  const cloudLogout = useCloudLogout();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManageRuntimesOpen, setIsManageRuntimesOpen] = useState(false);

  // Remote management is available anywhere inside the Meander host. On a board
  // it is backed by the live board context; on the start page (no board) it is
  // backed directly by the persisted remotes in settings.json.
  const boardContext = useBoardContext();
  const inBoard = !!boardContext;
  const canManageRemotes = isDiscoverySupported();

  // ── Start-page mode: remotes come from / go to the backend ──
  const [backendRemotes, setBackendRemotes] = useState<Remote[]>([]);
  const refreshBackendRemotes = useCallback(async () => {
    setBackendRemotes(await getRemotes());
  }, []);
  useEffect(() => {
    if (!inBoard && isManageRuntimesOpen) {
      void refreshBackendRemotes();
    }
  }, [inBoard, isManageRuntimesOpen, refreshBackendRemotes]);

  const persistRemoteRuntimes = (allEngines: RuntimeClass[]) => {
    localStorage.setItem(
      "available-remote-runtimes",
      JSON.stringify(allEngines.filter(isRemoteRuntime)),
    );
  };

  // Resolve data + handlers for whichever mode the menu is in.
  let remoteRuntimes: RuntimeClass[];
  let onAddRuntimeEngine: (desc: RuntimeClass) => void;
  let onRemoveRuntimeEngine: (desc: RuntimeClass) => void;
  let onUpdateRuntimeEngine: (desc: RuntimeClass) => void;

  if (inBoard) {
    // Mirror RuntimeMenu so a runtime added here matches the toolbar's behaviour.
    remoteRuntimes = (boardContext?.availableRuntimeEngines ?? []).filter(
      isRemoteRuntime,
    );
    onAddRuntimeEngine = (desc) =>
      persistRemoteRuntimes(boardContext?.addAvailableRuntime(desc, false) ?? []);
    onRemoveRuntimeEngine = (desc) =>
      persistRemoteRuntimes(boardContext?.removeAvailableRuntime(desc) ?? []);
    onUpdateRuntimeEngine = (desc) =>
      persistRemoteRuntimes(boardContext?.addAvailableRuntime(desc, true) ?? []);
  } else {
    remoteRuntimes = backendRemotes.map((r) => ({
      type: "rest",
      name: r.name,
      url: r.url,
      color: r.color,
    }));
    const toRemote = (desc: RuntimeClass): Remote => ({
      name: desc.name ?? desc.url ?? "",
      url: desc.url ?? "",
      port: 0,
      color: desc.color,
    });
    onAddRuntimeEngine = (desc) => {
      void saveRemote(toRemote(desc)).then(refreshBackendRemotes);
    };
    onRemoveRuntimeEngine = (desc) => {
      if (desc.name) {
        void deleteRemote(desc.name).then(refreshBackendRemotes);
      }
    };
    onUpdateRuntimeEngine = (desc) => {
      void saveRemote(toRemote(desc)).then(refreshBackendRemotes);
    };
  }

  return (
    <>
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
                <DropdownMenuRadioItem value="default">
                  Default
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="sketch">
                  Sketch
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {canManageRemotes && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-base"
                onSelect={() => setIsManageRuntimesOpen(true)}
              >
                <Search size={16} className="mr-2" />
                <span>Manage Remotes</span>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          {user ? (
            <DropdownMenuItem
              className="text-base"
              onSelect={() => void cloudLogout()}
            >
              <LogOut size={16} className="mr-2" />
              <span>{user.username ? `Log out (${user.username})` : "Log out"}</span>
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
      {canManageRemotes && (
        <ManageRuntimesDialog
          remoteRuntimes={remoteRuntimes}
          isOpen={isManageRuntimesOpen}
          onClose={() => setIsManageRuntimesOpen(false)}
          onAddRuntimeEngine={onAddRuntimeEngine}
          onRemoveRuntimeEngine={onRemoveRuntimeEngine}
          onUpdateRuntimeEngine={onUpdateRuntimeEngine}
        />
      )}
    </>
  );
}
