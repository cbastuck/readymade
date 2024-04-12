import { useState } from "react";
import { ChevronsUpDown, Settings } from "lucide-react";
import { CommandGroup, CommandList } from "cmdk";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RuntimeClass } from "@/types";
import ManageRuntimesDialog from "./ManageRuntimesDialog";

type Props = {
  availableRuntimes: Array<RuntimeClass>;
  onAddAvailableRuntime: (desc: RuntimeClass) => void;
  onRemoveAvailableRuntime: (desc: RuntimeClass) => void;
  onAddRuntime: (rtClass: RuntimeClass) => void;
};

export default function RuntimeMenu({
  availableRuntimes,
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
  const remoteRuntimes = availableRuntimes.filter((rt) => rt.type === "remote");
  const localRuntimes = availableRuntimes.filter((rt) => rt.type === "browser");
  const heightConstraint = remoteRuntimes.length ? "h-[160px]" : "";
  return (
    <>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[300px] justify-between my-1"
            onClick={() => open && setSearchTerm("")}
          >
            Add runtime
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={`w-[200px] p-0 ${heightConstraint} opacity-100`}
        >
          <Command>
            <CommandInput
              placeholder="Search"
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandEmpty>No service found</CommandEmpty>
            <CommandList className="overflow-auto">
              {localRuntimes.map((rt, idx) => (
                <CommandItem
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
                  {rt.name} Runtime
                </CommandItem>
              ))}

              {remoteRuntimes.map((rt, idx) => (
                <CommandItem
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
                className="flex gap-2"
                onSelect={() => setShowManageRuntimesDialog(true)}
              >
                <Settings size="18px" /> Manage remote runtimes
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
