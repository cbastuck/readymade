import { useCallback, useState } from "react";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import InputField from "hkp-frontend/src/components/shared/InputField";
import SubServicePipelineUI from "../../ui/SubServicePipelineUI";
import { findServiceUI } from "../UIRegistry";

type PipelineEntry = {
  serviceId: string;
  instanceId: string;
  serviceName?: string;
  state?: any;
};

type SwitchCase = {
  when: string;
  pipeline: PipelineEntry[];
};

// Matches the `matched` notification payload: case index, "default", or null
// when the input passed through unrouted.
type MatchedBranch = number | "default" | null;

type BranchKey = number | "default";

function ActiveDot({ isActive }: { isActive: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        flexShrink: 0,
        background: isActive ? "var(--hkp-accent)" : "transparent",
        border: isActive ? "none" : "1px solid hsl(var(--border))",
      }}
    />
  );
}

export default function SwitchUI(props: ServiceUIProps) {
  const [cases, setCases] = useState<SwitchCase[]>([]);
  const [defaultPipeline, setDefaultPipeline] = useState<PipelineEntry[]>([]);
  const [matched, setMatched] = useState<MatchedBranch | undefined>(undefined);
  const [, setScopeVersion] = useState(0);

  const onInit = (initialState: any) => {
    if (Array.isArray(initialState?.cases)) {
      setCases(initialState.cases);
    }
    if (Array.isArray(initialState?.default)) {
      setDefaultPipeline(initialState.default);
    }
  };

  const onNotification = useCallback((notification: any) => {
    if (Array.isArray(notification?.cases)) {
      setCases(notification.cases);
    }
    if (Array.isArray(notification?.default)) {
      setDefaultPipeline(notification.default);
    }
    if ("matched" in (notification || {})) {
      setMatched(notification.matched);
    }
    if (notification?.__innerScopesReady) {
      setScopeVersion((v) => v + 1);
    }
  }, []);

  const getActualInstance = useCallback(
    (instanceId: string): ServiceInstance | null => {
      const svc = props.service as any;
      return svc.getInnerInstance?.(instanceId) ?? null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.service],
  );

  const { service } = props;

  // Facade the branch as a service whose `pipeline` state and configure()
  // speak SubServicePipelineUI's protocol, translated into branch-scoped
  // configure calls on the Switch.
  const branchProxy = (
    branch: BranchKey,
    label: string,
    pipeline: PipelineEntry[],
  ): ServiceInstance =>
    ({
      uuid: `${service.uuid}-branch-${branch}`,
      serviceId: "hookup.to/service/switch",
      serviceName: label,
      state: { pipeline },
      app: service.app,
      board: service.board,
      configure: async (config: any) =>
        service.configure({ ...config, branch }),
      process: async () => {},
      getConfiguration: async () => ({ pipeline }),
      destroy: async () => {},
    }) as unknown as ServiceInstance;

  const renderBranch = (
    branch: BranchKey,
    pipeline: PipelineEntry[],
    isActive: boolean,
    whenExpression?: string,
  ) => (
    <div key={String(branch)} className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs">
        <ActiveDot isActive={isActive} />
        {branch === "default" ? (
          <span className="font-mono whitespace-nowrap">default</span>
        ) : (
          <InputField
            label=""
            value={whenExpression ?? ""}
            onChange={(when) => service.configure({ branch, when })}
          />
        )}
      </div>
      <div className="pl-4">
        <SubServicePipelineUI
          service={branchProxy(
            branch,
            branch === "default" ? "Default Pipeline" : `Case ${branch}`,
            pipeline,
          )}
          findServiceUI={findServiceUI}
          getActualInstance={getActualInstance}
          defaultCollapsed={true}
        />
      </div>
    </div>
  );

  return (
    <ServiceUI
      {...props}
      className="pb-2"
      onInit={onInit}
      onNotification={onNotification}
    >
      <div className="flex flex-col gap-1" style={{ minWidth: 260 }}>
        {cases.length === 0 && defaultPipeline.length === 0 ? (
          <div className="text-xs text-neutral-500">
            No cases configured — passing everything through.
          </div>
        ) : (
          <>
            {cases.map((c, i) =>
              renderBranch(i, c.pipeline, matched === i, c.when),
            )}
            {renderBranch("default", defaultPipeline, matched === "default")}
          </>
        )}
      </div>
    </ServiceUI>
  );
}
