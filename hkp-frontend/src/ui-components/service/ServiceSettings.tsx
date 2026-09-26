import { useMemo, useState } from "react";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Info,
  Menu,
  Play,
  StepForward,
  Trash,
  FileCog,
  Boxes,
} from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "hkp-frontend/src/ui-components/primitives/dropdown-menu";
import {
  CustomMenuEntry,
  ServiceDescriptor,
  toCanonicalRuntimeClassType,
} from "hkp-frontend/src/types";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import MenuIcon from "../MenuIcon";
import { useThemeControl } from "hkp-frontend/src/ui-components/ThemeContext";
import { useBoardContext } from "hkp-frontend/src/BoardContext";
import PresetMenu from "./PresetMenu";
import SavePresetDialog from "./SavePresetDialog";
import RunParamsDialog from "../runtime-ui/RunParamsDialog";
import { useServiceAddress } from "hkp-frontend/src/runtime/ui/BlockUse";
import { toCanonicalServiceId } from "hkp-frontend/src/types";

type Props = {
  service: ServiceDescriptor;
  isCollapsed: boolean;
  customMenuEntries?: Array<CustomMenuEntry>;
  onExpand: (expanded: boolean) => void;
  onDelete: () => void;
  helpUrl: string;
  onConfig: () => void;
  onCustomEntry: (item: CustomMenuEntry) => void;
};

function DragHandle() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2.5,
        padding: 2,
        opacity: 0.3,
        cursor: "grab",
      }}
    >
      <span
        style={{
          display: "block",
          width: 11,
          height: 1.5,
          background: "var(--text, #1a1a1a)",
          borderRadius: 2,
        }}
      />
      <span
        style={{
          display: "block",
          width: 11,
          height: 1.5,
          background: "var(--text, #1a1a1a)",
          borderRadius: 2,
        }}
      />
      <span
        style={{
          display: "block",
          width: 11,
          height: 1.5,
          background: "var(--text, #1a1a1a)",
          borderRadius: 2,
        }}
      />
    </div>
  );
}

export default function ServiceSettings({
  isCollapsed,
  service,
  customMenuEntries,
  helpUrl,
  onExpand,
  onDelete,
  onConfig,
  onCustomEntry,
}: Props) {
  const { themeName } = useThemeControl();
  const isPlayground = themeName === "playground";

  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [runWithParamsOpen, setRunWithParamsOpen] = useState(false);
  const boardContext = useBoardContext();
  // Presets are applied by recreating the instance on its runtime, and running
  // from here is a call into that runtime, so those entries appear only for a
  // service the board can find a runtime for. A panel rendered outside a
  // board's runtimes — a nested pipeline's own list — has no runtime to name,
  // and offering the action there would be offering one that fails.
  const runtimeId = useMemo(
    () =>
      Object.entries(boardContext?.services ?? {}).find(([, list]) =>
        list.some((svc) => svc.uuid === service.uuid),
      )?.[0] ?? null,
    [boardContext?.services, service.uuid],
  );
  const onBoard = runtimeId !== null;

  // A sub-service is a pipeline somebody built, which is what a block is made
  // of: made one, it becomes the first use of it and can be used again.
  const address = useServiceAddress() ?? service.uuid;
  const canMakeBlock =
    !!boardContext?.makeBlock &&
    toCanonicalServiceId(service.serviceId ?? "") === "sub-service";
  const makeBlock = () => {
    boardContext
      ?.makeBlock(address)
      .then((made) =>
        toast.success(`"${made.name}" is now a block of this board`, {
          description: "Add it again from the Building Blocks sidebar.",
        }),
      )
      .catch((err) => toast.error("Could not make a block", { description: err.message }));
  };

  /**
   * Runs the pipeline from this service onward, this service included, with
   * whatever the caller passes as its input. The services before it are left
   * alone — what the runtime's own Run cannot do, since that always starts at
   * the top.
   */
  const runFromHere = (params?: unknown) => {
    setRunWithParamsOpen(false);
    if (!boardContext || runtimeId === null) {
      return;
    }
    const runtime = boardContext.runtimes.find((rt) => rt.id === runtimeId);
    const scope = boardContext.scopes[runtimeId];
    const api =
      runtime &&
      (boardContext.runtimeApis[runtime.type] ||
        boardContext.runtimeApis[toCanonicalRuntimeClassType(runtime.type)]);
    if (scope && api) {
      Promise.resolve(api.processService(scope, service, params, null)).catch(
        (err) => console.error(`Running ${service.uuid} failed:`, err),
      );
    }
  };

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {isPlayground ? (
          <button
            type="button"
            title="Service options"
            className="bg-transparent border-none p-0 cursor-pointer flex items-center rounded flex-shrink-0"
            onMouseEnter={(e) => {
              (e.currentTarget.firstChild as HTMLElement).style.opacity = "0.6";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget.firstChild as HTMLElement).style.opacity = "0.3";
            }}
          >
            <DragHandle />
          </button>
        ) : (
          <Button className="p-4 h-min w-min" variant="ghost" size="icon">
            <Menu strokeWidth={1} />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 font-menu">
        <DropdownMenuLabel className="capitalize font-sans tracking-wider text-base">
          {service.serviceName} Service
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {onBoard && (
          <>
            <DropdownMenuItem
              onClick={() => runFromHere()}
              className="text-base"
            >
              <MenuIcon icon={Play} />
              <span>Run</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setRunWithParamsOpen(true)}
              className="text-base"
            >
              <MenuIcon icon={StepForward} />
              <span>Run with ...</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem onClick={onConfig} className="text-base">
          <MenuIcon icon={FileCog} />
          <span>Configuration</span>
        </DropdownMenuItem>

        {onBoard && (
          <PresetMenu
            service={service}
            onSave={() => setSavePresetOpen(true)}
          />
        )}

        {canMakeBlock && (
          <DropdownMenuItem onClick={makeBlock} className="text-base">
            <MenuIcon icon={Boxes} />
            <span>Make block</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {!isCollapsed ? (
          <DropdownMenuItem
            onClick={() => onExpand(false)}
            className="text-base"
          >
            <MenuIcon icon={ChevronsDownUp} />
            <span>Collapse</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => onExpand(true)}
            className="text-base"
          >
            <MenuIcon icon={ChevronsUpDown} />
            <span>Expand</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild className="text-base">
          <a href={helpUrl} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
            <MenuIcon icon={Info} />
            <span>Documentation</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-base">
          <MenuIcon icon={Trash} />
          <span>Delete</span>
        </DropdownMenuItem>

        {customMenuEntries && (
          <>
            <DropdownMenuSeparator />
            {customMenuEntries.map((item: CustomMenuEntry) => (
              <DropdownMenuItem
                className="text-base"
                key={item.name}
                onClick={() => onCustomEntry(item)}
                disabled={item.disabled}
              >
                {item.icon || null}
                <span>{item.name}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    {runWithParamsOpen && (
      <RunParamsDialog
        open={runWithParamsOpen}
        onClose={() => setRunWithParamsOpen(false)}
        onRun={runFromHere}
        target="this service"
      />
    )}
    {savePresetOpen && (
      <SavePresetDialog
        service={service}
        isOpen={savePresetOpen}
        onOpenChange={setSavePresetOpen}
      />
    )}
    </>
  );
}
