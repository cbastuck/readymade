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
  /** Sit in a row of small controls rather than lead a panel of its own. The
   *  full-size trigger is 40px tall, which makes whatever shares its row jump
   *  down when it appears. Styled inline: the height it overrides comes from a
   *  class of the same specificity, where source order rather than the class
   *  list would decide the winner. */
  compact?: boolean;
};

export default function ServiceSelector({
  id,
  registry,
  onAddService,
  compact = false,
}: Props) {
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
          style={
            compact
              ? {
                  height: 22,
                  width: 150,
                  padding: "0 6px",
                  fontSize: 12,
                }
              : undefined
          }
          disabled={!registry || registry.length === 0}
        >
          Add Service
          <ChevronsUpDown
            className={`ml-2 shrink-0 opacity-50 ${compact ? "h-3 w-3" : "h-4 w-4"}`}
          />
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
          <CommandEmpty className="text-sm p-2">No service found</CommandEmpty>
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
