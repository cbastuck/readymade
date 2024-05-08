import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { CommandList } from "cmdk";

import { Button } from "@/ui-components/primitives/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
} from "@/ui-components/primitives/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui-components/primitives/popover";

import { ServiceClass, ServiceRegistry } from "@/types";

type Props = {
  id: string;
  registry: ServiceRegistry;
  onAddService: (svc: ServiceClass) => void;
};

export default function ServiceSelector({ id, registry, onAddService }: Props) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const onSelect = (value: string) => {
    const svc = registry.find((s) => s.serviceId === value);
    if (svc) {
      onAddService(svc);
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={`service-selector-${id}`}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between text-base"
        >
          Add Service
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 h-[260px] opacity-100">
        <Command>
          <CommandInput
            className="text-base"
            placeholder="Search"
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandEmpty className="text-base p-2">
            No service found
          </CommandEmpty>
          <CommandList className="overflow-auto">
            {registry &&
              registry.map((s) => (
                <CommandItem
                  className="text-base"
                  key={s.serviceId}
                  value={s.serviceId}
                  onSelect={(currentValue) => {
                    onSelect(currentValue);
                    setSearchTerm("");
                  }}
                  disabled={false}
                >
                  {s.serviceName}
                </CommandItem>
              ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
