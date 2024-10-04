import { useState } from "react";
import { ChevronsUpDown, Settings } from "lucide-react";
import { CommandGroup, CommandList } from "cmdk";

import { Button } from "@/ui-components/primitives/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandSeparator,
} from "@/ui-components/primitives/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui-components/primitives/popover";
import { RuntimeClass } from "@/types";
import ManageRuntimesDialog from "./ManageRuntimesDialog";

type Props = {
  availableRuntimeEngines: Array<RuntimeClass>;
  onAddAvailableRuntime: (desc: RuntimeClass) => void;
  onRemoveAvailableRuntime: (desc: RuntimeClass) => void;
  onAddRuntime: (rtClass: RuntimeClass) => void;
};

export default function RuntimeMenu({
  availableRuntimeEngines,
  onAddAvailableRuntime,
  onRemoveAvailableRuntime,
  onAddRuntime,
}: Props) {
  const onAddNewRemoteRuntime = (rt: RuntimeClass) => {
    onAddAvailableRuntime(rt);
  };

  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [showManageRuntimesDialog, setShowManageRuntimesDialog] =
    useState(false);

  const onOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSearchTerm("");
    }
    setOpen(newOpen);
  };
  const remoteRuntimes = availableRuntimeEngines.filter(
    (rt) => rt.type === "remote"
  );
  const localRuntimes = availableRuntimeEngines.filter(
    (rt) => rt.type === "browser"
  );
  const heightConstraint = remoteRuntimes.length ? "h-[170px]" : "";
  return (
    <>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id="runtime-menu-trigger"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[300px] justify-between my-1 text-base"
            onClick={() => open && setSearchTerm("")}
          >
            Add Runtime
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={`w-[300px] p-0 ${heightConstraint} opacity-100 font-menu`}
        >
          <Command>
            <CommandInput
              className="text-base"
              placeholder="Search"
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandEmpty className="text-base p-2">
              No Runtime found
            </CommandEmpty>
            <CommandList className="overflow-auto">
              {localRuntimes.map((rt, idx) => (
                <CommandItem
                  className="text-base"
                  key={`${rt.type}${rt.name}`}
                  value={`${rt.name}|${idx}`}
                  onSelect={(currentValue) => {
                    const idx = currentValue.slice(
                      currentValue.lastIndexOf("|") + 1
                    );
                    onAddRuntime(localRuntimes[Number(idx)]);
                    setSearchTerm("");
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
                  onSelect={(currentValue) => {
                    const idx = currentValue.slice(
                      currentValue.lastIndexOf("|") + 1
                    );
                    onAddRuntime(remoteRuntimes[Number(idx)]);
                    setSearchTerm("");
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
                <Settings size="18px" /> Manage Remote Runtimes
              </CommandItem>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      <ManageRuntimesDialog
        remoteRuntimes={remoteRuntimes}
        isOpen={showManageRuntimesDialog}
        onClose={() => setShowManageRuntimesDialog(false)}
        onRemoveRuntime={onRemoveAvailableRuntime}
        onAddAvailableRuntime={onAddNewRemoteRuntime}
      />
    </>
  );
}
