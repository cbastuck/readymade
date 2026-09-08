import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Maximize2 } from "lucide-react";

import {
  ServiceAction,
  ServiceClass,
  ServiceInstance,
  ServiceUIComponent,
} from "hkp-frontend/src/types";
import ServiceSelector from "hkp-frontend/src/ui-components/ServiceSelector";
import {
  findServiceUI as restFindServiceUI,
  type ServiceLookup,
} from "../rest/UIRegistry";
import RuntimeRestServiceUI from "../rest/RuntimeRestServiceUI";
import ServiceWithDropBars from "../ServiceWithDropBars";
import { useIsMobileHost } from "hkp-frontend/src/MobileHostContext";
import {
  useTheme,
  useThemeControl,
} from "hkp-frontend/src/ui-components/ThemeContext";
import {
  InlineHopsContext,
  LevelDepthContext,
  useInlineHops,
  useLevelDepth,
  useNestedNavigation,
} from "./NestedNavigation";

type PipelineEntry = {
  serviceId: string;
  instanceId: string;
  state?: any;
};

type FindServiceUI = (
  service: string | ServiceLookup,
) => ServiceUIComponent | null;

type Props = {
  service: ServiceInstance;
  findServiceUI?: FindServiceUI;
  FallbackUI?: React.ComponentType<any>;
  /** Optional: returns the real in-process service instance for a given instanceId.
   *  When provided and non-null, the real instance is used for the service UI so
   *  that notification channels (app.registerNotificationTarget) wire up correctly. */
  getActualInstance?: (instanceId: string) => ServiceInstance | null;
  /** Start with the pipeline content folded. */
  defaultCollapsed?: boolean;
  /** What this pipeline is called in the breadcrumb trail once opened. A host
   *  with several pipelines names the branch as well as itself, since the trail
   *  would otherwise say only which service the level came from. */
  levelLabel?: string;
};

export default function SubServicePipelineUI({
  service,
  findServiceUI = restFindServiceUI,
  FallbackUI = RuntimeRestServiceUI,
  getActualInstance,
  defaultCollapsed = true,
  levelLabel,
}: Props) {
  const pipeline: PipelineEntry[] = service.state?.pipeline ?? [];
  const registry = service.app.listAvailableServices();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const isMobileHost = useIsMobileHost();
  const navigation = useNestedNavigation();
  const depth = useLevelDepth();
  const inlineHops = useInlineHops();

  const label =
    levelLabel || service.serviceName || service.serviceId || "Pipeline";
  const isOpen = navigation?.stack[depth]?.id === service.uuid;
  const layer = isOpen ? (navigation?.layerFor(depth + 1) ?? null) : null;

  // A trail must not outlive what it points at: a host that goes away — its
  // service removed, its board reloaded — closes the level it opened. Read
  // through a ref, because the navigation changes identity on every push and
  // this must run when the host unmounts and at no other time.
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;
  useEffect(
    () => () => {
      navigationRef.current?.close(service.uuid);
    },
    [service.uuid],
  );

  // The mobile host renders its own breadcrumb pipeline navigation, so don't
  // draw the desktop drag-and-drop editor on top of it.
  if (isMobileHost) {
    return null;
  }

  const append = (svc: { serviceId: string }) => {
    service.configure({ appendService: { serviceId: svc.serviceId } });
  };

  const selector = (idPrefix: string, compact = false) => (
    <ServiceSelector
      id={`${idPrefix}-${service.uuid}`}
      registry={registry}
      onAddService={append}
      compact={compact}
    />
  );

  return (
    <div className="w-full flex flex-col">
      {/* Where the content can be shown, and the two places it can be shown in:
          here inside the panel, or on a level of its own. */}
      <div className="flex w-full items-center gap-2 mt-1">
        <span
          className="text-gray-400 whitespace-nowrap"
          style={{ fontSize: 12 }}
        >
          Show nested sevices
        </span>

        <button
          className="hkp-svc-btn hkp-svc-btn--icon flex items-center"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Show content inline" : "Hide inline content"}
          title={collapsed ? "Show content inline" : "Hide inline content"}
        >
          {collapsed ? (
            <ChevronRight size={14} strokeWidth={1.5} />
          ) : (
            <ChevronDown size={14} strokeWidth={1.5} />
          )}
        </button>

        {navigation && (
          <button
            className="hkp-svc-btn hkp-svc-btn--icon flex items-center"
            onClick={() =>
              navigation.open(service.uuid, label, depth, inlineHops > 0)
            }
            aria-label={`Open ${label} as its own level`}
            title={`Open ${label} as its own level`}
          >
            <Maximize2 size={14} strokeWidth={1.5} />
          </button>
        )}

        {!collapsed && (
          <div className="flex ml-auto">{selector("sub-pipeline", true)}</div>
        )}
      </div>

      {/* Shown here rather than opened, so anything nested inside it is one
          more hop from the level this panel sits on. */}
      {!collapsed &&
        (pipeline.length === 0 ? (
          <div className="text-xs text-neutral-500">Empty container</div>
        ) : (
          <InlineHopsContext.Provider value={inlineHops + 1}>
            <PipelineStrip
              service={service}
              pipeline={pipeline}
              registry={registry}
              findServiceUI={findServiceUI}
              FallbackUI={FallbackUI}
              getActualInstance={getActualInstance}
            />
          </InlineHopsContext.Provider>
        ))}

      {/* Opened, this pipeline renders on its own level instead — still from
          here, so it stays live and stays this host's to configure. A level is
          where the trail can account for things again, so the hops reset. */}
      {layer &&
        createPortal(
          <LevelDepthContext.Provider value={depth + 1}>
            <InlineHopsContext.Provider value={0}>
              <PipelineLevel
                label={label}
                selector={selector("sub-pipeline-level", true)}
                isEmpty={pipeline.length === 0}
              >
                <PipelineStrip
                  service={service}
                  pipeline={pipeline}
                  registry={registry}
                  findServiceUI={findServiceUI}
                  FallbackUI={FallbackUI}
                  getActualInstance={getActualInstance}
                />
              </PipelineLevel>
            </InlineHopsContext.Provider>
          </LevelDepthContext.Provider>,
          layer,
        )}
    </div>
  );
}

/**
 * A pipeline filling a level of its own.
 *
 * It wears the chrome a runtime wears — the same frame, header strip and
 * background RuntimeUI draws — because that is what it is: an ordered list of
 * services, called in order, that happens to sit inside a service rather than
 * beside one. Dropping the frame here would leave the services floating on the
 * page with nothing saying what they belong to.
 */
function PipelineLevel({
  label,
  selector,
  isEmpty,
  children,
}: {
  label: string;
  selector: React.ReactNode;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const { densityId } = useThemeControl();
  const compact = densityId === "compact";

  return (
    // A block, not a flex column: the runtime frame carries `align-self:
    // flex-start`, which in a column flex would size it to its content — as
    // wide as every service on it — and the level would scroll sideways around
    // a strip that already scrolls on its own. On a board its parent is a plain
    // block too, so the frame simply fills the width it is given.
    <div style={{ padding: 12 }}>
      <div
        className="hkp-runtime-container select-none"
        style={{
          border: `solid 1px ${theme.borderColor}`,
          borderRadius: theme.borderRadius,
          backgroundColor: theme.runtimeBackgroundColor,
          backgroundImage: theme.runtimeBackgroundImage,
          boxShadow: theme.runtimeBoxShadow,
          color: theme.textColor,
        }}
      >
        {/* The same height a runtime header is: its own controls are sized
            down to their icons, so a full-size trigger here — 40px, against a
            24px icon row — would make this strip taller than every header on
            the board it is standing in for. */}
        <div
          className={`hkp-runtime-header bg-[#FFFFFF8F] border-b border-gray-300 flex items-center gap-3 px-4 ${
            compact ? "py-1" : "py-2"
          }`}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
          <div className="flex ml-auto">{selector}</div>
        </div>

        <div className="p-4">
          {isEmpty ? (
            <div className="text-xs text-neutral-500">
              Empty container — add a service to start this pipeline.
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The services of one pipeline, in order, as the runtime will call them.
 *
 * Rendered the same whether it sits inside its host's panel or fills a level of
 * its own — the two differ in where they are, not in what editing a nested
 * pipeline means.
 */
function PipelineStrip({
  service,
  pipeline,
  registry,
  findServiceUI,
  FallbackUI,
  getActualInstance,
}: {
  service: ServiceInstance;
  pipeline: PipelineEntry[];
  registry: ServiceClass[];
  findServiceUI: FindServiceUI;
  FallbackUI: React.ComponentType<any>;
  getActualInstance?: (instanceId: string) => ServiceInstance | null;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCountRef = useRef(0);

  const findDescriptor = (serviceId: string): ServiceClass | undefined =>
    registry.find((entry) => entry.serviceId === serviceId);

  const remove = (instanceId: string) => {
    service.configure({ removeService: instanceId });
  };

  const rearrange = (movedInstanceId: string, targetPos: number) => {
    const newPipeline = pipeline.filter(
      (entry) => entry.instanceId !== movedInstanceId,
    );
    const movedEntry = pipeline.find(
      (entry) => entry.instanceId === movedInstanceId,
    );
    if (!movedEntry) {
      return;
    }
    newPipeline.splice(targetPos, 0, movedEntry);
    service.configure({ pipeline: newPipeline });
  };

  return (
    // The strip scrolls sideways the way a runtime's own does, rather than
    // compressing what is on it — see RuntimeRest, which wraps its services in
    // the same scroller.
    <div
      className="flex overflow-x-auto overscroll-x-none"
      onDragStart={() => {
        dragCountRef.current += 1;
        setIsDragging(true);
      }}
      onDragEnd={() => {
        dragCountRef.current = Math.max(0, dragCountRef.current - 1);
        if (dragCountRef.current === 0) {
          setIsDragging(false);
        }
      }}
      onDrop={() => {
        dragCountRef.current = 0;
        setIsDragging(false);
      }}
    >
      {pipeline.map((entry, pos) => {
        const descriptor = findDescriptor(entry.serviceId);

        const onSubServiceAction = (command: ServiceAction) => {
          if (command.action === "remove") {
            remove(entry.instanceId);
          }
        };

        // Proxy instance: routes configure() through the parent sub-service
        // so that config changes are persisted in the outer state.
        const configureProxy = async (config: object) => {
          await service.configure({
            configureService: {
              instanceId: entry.instanceId,
              state: config,
            },
          });
        };

        const proxyInstance: ServiceInstance = {
          uuid: entry.instanceId,
          serviceId: entry.serviceId,
          serviceName: descriptor?.serviceName ?? entry.serviceId,
          version: descriptor?.version,
          capabilities: descriptor?.capabilities,
          state: entry.state,
          app: service.app,
          board: service.board,
          configure: configureProxy,
          process: async () => {},
          getConfiguration: async () => entry.state,
          destroy: async () => {},
        };

        // If a real in-process instance is available (browser pipeline mode),
        // use it so that notification targets wire up to the inner scope's app.
        // Keep configure() pointing at the proxy so config changes are persisted.
        const realInstance = getActualInstance?.(entry.instanceId);
        const subServiceInstance: ServiceInstance = realInstance
          ? { ...realInstance, configure: configureProxy }
          : proxyInstance;

        // Look the service up the way a top-level one is looked up: by id
        // *and* version. A pipeline entry carries neither version nor
        // capabilities — only the runtime's registry knows them — so
        // without this a versioned service falls back to the UI of its
        // older revision.
        const SubServiceUI =
          (entry.serviceId &&
            findServiceUI({
              serviceId: entry.serviceId,
              version: descriptor?.version,
              capabilities: descriptor?.capabilities,
            })) ||
          FallbackUI;

        const uiElement = React.createElement(SubServiceUI as any, {
          service: subServiceInstance,
          showBypassOnlyIfExplicit: true,
          draggable: true,
          onServiceAction: onSubServiceAction,
        });

        return (
          <div
            key={entry.instanceId}
            style={{
              display: "flex",
              flexDirection: "row",
              position: "relative",
              // Earlier cards sit above later ones so their drop zone stays
              // clickable over the next card.
              zIndex: pipeline.length - pos,
              // The card inside refuses to shrink (ServiceFrame sets
              // flexShrink: 0), so a shrinking wrapper lets it overflow
              // unclipped and overlap the next service. ServiceUiContainer
              // guards a runtime's own services the same way.
              flexShrink: 0,
            }}
          >
            <ServiceWithDropBars
              index={pos}
              isFirst={pos === 0}
              isDragging={isDragging}
              onDrop={rearrange}
            >
              <div className="px-0.5">{uiElement}</div>
            </ServiceWithDropBars>
          </div>
        );
      })}
    </div>
  );
}
