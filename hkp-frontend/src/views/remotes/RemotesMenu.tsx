import { useState } from "react";
import { ChevronsUpDown, Settings } from "lucide-react";
import { CommandGroup, CommandList } from "cmdk";

import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import {
  Command,
  CommandEmpty,
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
import ManageRuntimesDialog from "../../ui-components/toolbar/ManageRuntimesDialog.tsx";

type Props = {
  value: RuntimeClass | undefined;
  availableRuntimeEngines: Array<RuntimeClass>;
  onAddAvailableRuntimeEngine: (desc: RuntimeClass) => void;
  onRemoveAvailableRuntimeEngine: (desc: RuntimeClass) => void;
  onUpdateRuntimeEngine: (updated: RuntimeClass) => void;
  onSelectEngine: (rt: RuntimeClass) => void;
};

export default function RemotesMenu({
  value,
  availableRuntimeEngines,
  onAddAvailableRuntimeEngine,
  onRemoveAvailableRuntimeEngine,
  onUpdateRuntimeEngine,
  onSelectEngine,
}: Props) {
  const onAddNewRemoteRuntime = (rt: RuntimeClass) => {
    onAddAvailableRuntimeEngine(rt);
  };

  const [open, setOpen] = useState(false);

  const [showManageRuntimesDialog, setShowManageRuntimesDialog] =
    useState(false);

  const onOpenChange = (newOpen: boolean) => setOpen(newOpen);

  const remoteRuntimes = availableRuntimeEngines.filter(
    (rt) =>
      isRuntimeGraphQLClassType(rt.type) || isRuntimeRestClassType(rt.type),
  );

  const heightConstraint = undefined;
  return (
    <>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id="runtime-menu-trigger"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[300px] justify-between text-base tracking-widest border-none bg-transparent"
          >
            {value?.name || "Select Runtime"}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={`w-[300px] p-0 ${heightConstraint} opacity-100 font-menu`}
        >
          <Command>
            <CommandEmpty className="text-base p-2">
              No Runtime found
            </CommandEmpty>
            <CommandList className="overflow-auto">
              {remoteRuntimes.map((rt, idx) => (
                <CommandItem
                  className="text-base"
                  key={`${rt.type}${rt.name}`}
                  value={`${rt.name}|${idx}`}
                  onSelect={(currentValue) => {
                    const idx = currentValue.slice(
                      currentValue.lastIndexOf("|") + 1,
                    );
                    onSelectEngine(remoteRuntimes[Number(idx)]);
                  }}
                >
                  {rt.name}
                </CommandItem>
              ))}
            </CommandList>
            <CommandSeparator />
            <CommandGroup className="mt-auto">
              <CommandItem
                className="flex gap-2 text-base"
                onSelect={() => setShowManageRuntimesDialog(true)}
              >
                <Settings size="18px" /> Manage Runtime Servers
              </CommandItem>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      <ManageRuntimesDialog
        remoteRuntimes={remoteRuntimes}
        isOpen={showManageRuntimesDialog}
        onClose={() => setShowManageRuntimesDialog(false)}
        onRemoveRuntimeEngine={onRemoveAvailableRuntimeEngine}
        onAddRuntimeEngine={onAddNewRemoteRuntime}
        onUpdateRuntimeEngine={onUpdateRuntimeEngine}
      />
    </>
  );
}
