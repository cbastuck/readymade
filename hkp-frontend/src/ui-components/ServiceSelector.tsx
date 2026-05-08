import { useContext, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { CommandList } from "cmdk";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
} from "hkp-frontend/src/ui-components/primitives/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "hkp-frontend/src/ui-components/primitives/popover";

import { ServiceClass, ServiceRegistry } from "hkp-frontend/src/types";
import { ThemeCtx } from "hkp-frontend/src/ui-components/ThemeContext";

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
  const theme = useContext(ThemeCtx);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={`service-selector-${id}`}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between text-sm border-none bg-transparent hover:bg-[var(--hkp-accent-violet-dim)] hover:text-[var(--hkp-accent-violet)]"
          disabled={!registry || registry.length === 0}
        >
          Add Service
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 h-[260px] opacity-100 font-menu">
        <Command style={{ borderRadius: theme.borderRadius }}>
          <CommandInput
            id={`service-selector-search-${id}`}
            className="text-sm"
            placeholder="Search Service"
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandEmpty className="text-sm p-2">
            No service found
          </CommandEmpty>
          <CommandList className="overflow-auto">
            {registry &&
              registry.map((s) => (
                <CommandItem
                  className="text-sm aria-selected:bg-[var(--hkp-accent-violet-dim)] aria-selected:text-[var(--hkp-accent-violet)]"
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
