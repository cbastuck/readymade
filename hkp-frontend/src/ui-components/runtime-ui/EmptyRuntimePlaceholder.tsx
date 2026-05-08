import { useState } from "react";
import { CommandList } from "cmdk";

import { s, t } from "hkp-frontend/src/styles";
import { RuntimeDescriptor, ServiceClass } from "hkp-frontend/src/types";
import { useThemeControl } from "hkp-frontend/src/ui-components/ThemeContext";
import { useBoardContext } from "hkp-frontend/src/BoardContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "hkp-frontend/src/ui-components/primitives/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
} from "hkp-frontend/src/ui-components/primitives/command";

type Props = {
  runtime: RuntimeDescriptor;
};

export default function EmptyRuntimePlaceholder({ runtime }: Props) {
  const { themeName } = useThemeControl();
  const isPlayground = themeName === "playground";

  const boardContext = useBoardContext();
  const registry = boardContext?.registry[runtime.id] ?? [];

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const onSelectService = (svc: ServiceClass) => {
    boardContext?.addService(svc, runtime);
    setSearchTerm("");
    setPopoverOpen(false);
  };

  const addServiceBtn = (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="hkp-add-service-btn" style={{ alignSelf: "auto", minHeight: 36 }}>
          + Add Service
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 h-[260px] font-menu" align="start">
        <Command>
          <CommandInput
            placeholder="Search service…"
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandEmpty className="text-base p-2">No service found</CommandEmpty>
          <CommandList className="overflow-auto">
            {registry.map((svc) => (
              <CommandItem
                className="text-base aria-selected:bg-[var(--hkp-accent-dim)] aria-selected:text-[var(--hkp-accent)]"
                key={svc.serviceId}
                value={svc.serviceId}
                onSelect={() => onSelectService(svc)}
              >
                {svc.serviceName}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  if (isPlayground) {
    return (
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 160,
          gap: 10,
        }}
      >
        <div style={{ fontSize: 12, color: "var(--text-dim, #9ca3af)" }}>No services yet</div>
        {addServiceBtn}
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        margin: "auto",
        textAlign: "center",
        minHeight: 220,
      }}
    >
      <div style={s(t.fs13, t.ls1, { marginTop: 90 })}>
        This is an empty runtime.
        <span
          style={{ cursor: "help", color: "#4284C4" }}
          onClick={() => setPopoverOpen(true)}
        >
          {" Add a service "}
        </span>
        to get going
        {addServiceBtn}
      </div>
    </div>
  );
}
