import { ReactElement, useMemo, useState } from "react";

import ServiceWithDropBars from "./ServiceWithDropBars";
import { RuntimeDescriptor, ServiceClass, ServiceInstance } from "../types";
import { useThemeControl } from "../ui-components/ThemeContext";
import { useBoardContext } from "../BoardContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui-components/primitives/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
} from "../ui-components/primitives/command";
import { CommandList } from "cmdk";

type Props = {
  userId: string | undefined;
  boardName: string;
  runtime: RuntimeDescriptor;
  services: Array<ServiceInstance>;
  collapsed?: boolean;
  className?: string;
  wrapServices?: boolean;
  onArrangeService: (serviceUuid: string, position: number) => void;
  onCreateServiceUi: (
    boardName: string,
    service: ServiceInstance,
    runtimeId: string,
    userId: string | undefined,
  ) => ReactElement;
};

export default function ServiceUiContainer(props: Props) {
  const {
    userId,
    boardName,
    runtime,
    services,
    className,
    collapsed = false,
    wrapServices = false,
    onArrangeService,
    onCreateServiceUi,
  } = props;

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

  const runtimeId = runtime.id;
  const serviceElements = useMemo(() => {
    return services
      ? services.map((service) =>
          onCreateServiceUi(boardName, service, runtimeId, userId),
        )
      : [];
  }, [services, runtimeId, userId, boardName, onCreateServiceUi]);

  if (!services) {
    return null;
  }

  return (
    <div
      className={`overflow-y-hidden w-full pb-4 mt-3 p-4 ${className || ""} ${
        wrapServices ? "flex-wrap" : ""
      }`}
    >
      {serviceElements.flatMap((serviceElement, pos) => {
        const card = (
          <div
            key={`service-ui-container-${services[pos].uuid}`}
            style={{
              display: collapsed ? "none" : "flex",
              flexDirection: "row",
              position: "relative",
              zIndex: 1,
              paddingBottom: 10,
            }}
          >
            <ServiceWithDropBars
              index={pos}
              onDrop={onArrangeService}
              allowDropBehind={pos === services.length - 1}
            >
              {serviceElement}
            </ServiceWithDropBars>
          </div>
        );
        return [card];
      })}
      {isPlayground && !collapsed && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="hkp-add-service-btn">
              + Add Service
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[200px] p-0 h-[260px] font-menu"
            align="start"
          >
            <Command>
              <CommandInput
                placeholder="Search service…"
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
              <CommandEmpty className="text-base p-2">
                No service found
              </CommandEmpty>
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
      )}
    </div>
  );
}
