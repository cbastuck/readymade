import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { CommandList } from "cmdk";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { AppViewMode, ServiceClass, ServiceRegistry } from "@/types";

import ServiceDropdown from "@/components/ServiceDropdown";

type Props = {
  runtimeId: string;
  registry: ServiceRegistry;
  appViewMode?: AppViewMode;
  onAddService: (svc: ServiceClass) => void;
};

export default function RuntimeServiceMenu({
  runtimeId,
  registry,
  onAddService,
}: Props) {
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
          id={`service-menu-${runtimeId}`}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          Add service
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 h-[260px] opacity-100">
        <Command>
          <CommandInput
            placeholder="Search"
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandEmpty>No service found</CommandEmpty>
          <CommandList className="overflow-auto">
            {registry &&
              registry.map((s) => (
                <CommandItem
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

export function ServiceMenu({
  runtimeId,
  registry,
  appViewMode,
  onAddService,
}: Props) {
  const wide = appViewMode === "wide";
  const options = registry.map((s) => ({
    key: `${runtimeId}${s.serviceId}`,
    value: s.serviceId,
    text: s.serviceName,
    selected: false,
  }));

  return (
    <ServiceDropdown
      // ref={(dropdown) => (this.dropdown = dropdown)}
      options={options}
      wide={wide}
      onSelected={(serviceId: string) => {
        const service = registry.find((s) => s.serviceId === serviceId);
        if (service) {
          onAddService(service);
        }
      }}
    />
  );
}
