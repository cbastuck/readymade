import { CSSProperties, useState } from "react";
import { Settings, Plus } from "lucide-react";
import { CommandGroup, CommandList } from "cmdk";

import { useBoardContext } from "hkp-frontend/src/BoardContext";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandSeparator,
} from "hkp-frontend/src/ui-components/primitives/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "hkp-frontend/src/ui-components/primitives/popover";
import {
  isRuntimeGraphQLClassType,
  isRuntimeRestClassType,
  RuntimeClass,
} from "hkp-frontend/src/types";
import { useThemeControl } from "hkp-frontend/src/ui-components/ThemeContext";
import ManageRuntimesDialog from "./ManageRuntimesDialog";

type Props = {
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
};

export default function RuntimeMenu({ triggerClassName, triggerStyle }: Props) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showManageRuntimesDialog, setShowManageRuntimesDialog] = useState(false);
  const { themeName } = useThemeControl();
  const isPlayground = themeName === "playground";
  const boardContext = useBoardContext();

  const availableRuntimeEngines = boardContext?.availableRuntimeEngines ?? [];

  const persistRemoteRuntimes = (allEngines: RuntimeClass[]) => {
    const remote = allEngines.filter(
      (rt) => isRuntimeGraphQLClassType(rt.type) || isRuntimeRestClassType(rt.type),
    );
    localStorage.setItem("available-remote-runtimes", JSON.stringify(remote));
  };

  const onAddRuntime = (rtClass: RuntimeClass) => {
    if (!boardContext) return;
    boardContext.addRuntime({
      ...rtClass,
      name: `${rtClass.name} ${boardContext.runtimes.length + 1}`,
    });
  };

  const onAddRuntimeEngine = (desc: RuntimeClass) => {
    const updated = boardContext?.addAvailableRuntime(desc, false) ?? [];
    persistRemoteRuntimes(updated);
  };

  const onRemoveRuntimeEngine = (desc: RuntimeClass) => {
    const updated = boardContext?.removeAvailableRuntime(desc) ?? [];
    persistRemoteRuntimes(updated);
  };

  const onUpdateRuntimeEngine = (desc: RuntimeClass) => {
    const updated = boardContext?.addAvailableRuntime(desc, true) ?? [];
    persistRemoteRuntimes(updated);
  };

  const onOpenChange = (newOpen: boolean) => {
    if (!newOpen) setSearchTerm("");
    setOpen(newOpen);
  };

  const remoteRuntimes = availableRuntimeEngines.filter(
    (rt) => isRuntimeGraphQLClassType(rt.type) || isRuntimeRestClassType(rt.type),
  );
  const localRuntimes = availableRuntimeEngines.filter((rt) => rt.type === "browser");

  const popoverStyle = isPlayground
    ? {
        background: "var(--bg-card, white)",
        border: "1px solid var(--border-mid, #e2ddd7)",
        borderRadius: 10,
        boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
        padding: 0,
      }
    : {};

  return (
    <>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={triggerClassName ?? "hkp-add-runtime-btn"}
            style={triggerStyle}
          >
            <Plus size={13} />
            Add Runtime
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[260px] p-0 opacity-100 font-menu"
          style={popoverStyle}
          align="start"
          sideOffset={6}
        >
          <Command className={isPlayground ? "hkp-runtime-command" : ""}>
            <CommandInput
              className="text-base"
              placeholder="Search runtime…"
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandEmpty className="text-base p-2">No runtime found</CommandEmpty>
            <CommandList className="overflow-auto">
              {localRuntimes.map((rt, idx) => (
                <CommandItem
                  className="text-base"
                  key={`${rt.type}${rt.name}`}
                  value={`${rt.name}|${idx}`}
                  onSelect={(v) => {
                    onAddRuntime(localRuntimes[Number(v.slice(v.lastIndexOf("|") + 1))]);
                    setSearchTerm("");
                    setOpen(false);
                  }}
                >
                  {rt.name}
                </CommandItem>
              ))}
              {remoteRuntimes.map((rt, idx) => (
                <CommandItem
                  className="text-base"
                  key={`${rt.type}${rt.name}`}
                  value={`${rt.name}|${idx}`}
                  onSelect={(v) => {
                    onAddRuntime(remoteRuntimes[Number(v.slice(v.lastIndexOf("|") + 1))]);
                    setSearchTerm("");
                    setOpen(false);
                  }}
                >
                  {rt.name}
                </CommandItem>
              ))}
            </CommandList>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                className="flex gap-2 text-base"
                onSelect={() => {
                  setOpen(false);
                  setShowManageRuntimesDialog(true);
                }}
              >
                <Settings size={14} />
                Manage Runtime Engines
              </CommandItem>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      <ManageRuntimesDialog
        remoteRuntimes={remoteRuntimes}
        isOpen={showManageRuntimesDialog}
        onClose={() => setShowManageRuntimesDialog(false)}
        onRemoveRuntimeEngine={onRemoveRuntimeEngine}
        onAddRuntimeEngine={onAddRuntimeEngine}
        onUpdateRuntimeEngine={onUpdateRuntimeEngine}
      />
    </>
  );
}
