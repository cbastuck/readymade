import { useCallback, useState } from "react";

import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import InputField from "hkp-frontend/src/components/shared/InputField";
import Button from "hkp-frontend/src/ui-components/Button";
import SubServicePipelineUI from "../../ui/SubServicePipelineUI";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
import { findServiceUI } from "../UIRegistry";

/**
 * The manager and the actions around it.
 *
 * The service holds one pipeline per action rather than the single `pipeline`
 * every other nested host has, so the generic editor cannot draw it: each
 * action gets its own editor, pointed at that branch. `SubServicePipelineUI`
 * speaks one protocol — `pipeline`, `appendService`, `removeService`,
 * `configureService` — so each branch is handed a stand-in service that
 * re-tags whatever it is told with the branch it belongs to, which is how
 * Switch does the same job in the browser runtime.
 */

type PipelineEntry = { serviceId: string; instanceId: string; state?: any };

type Action = {
  name: string;
  describe: string;
  available: string;
  pipeline: PipelineEntry[];
};

const DESCRIPTION_STYLE = { fontSize: 12, opacity: 0.7 } as const;

export default function CommunicationDispatcherUI(props: ServiceUIProps) {
  const { service } = props;
  const [goal, setGoal] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const [decide, setDecide] = useState<PipelineEntry[]>([]);
  const [states, setStates] = useState<Array<{ name: string; describe: string }>>([]);
  const [lastAction, setLastAction] = useState("");
  const [lastReason, setLastReason] = useState("");
  const [error, setError] = useState("");
  const [newAction, setNewAction] = useState("");

  const read = useCallback((state: any) => {
    if (!state) {
      return;
    }
    if (typeof state.goal === "string") {
      setGoal(state.goal);
    }
    if (Array.isArray(state.actions)) {
      setActions(state.actions);
    }
    if (Array.isArray(state.decide)) {
      setDecide(state.decide);
    }
    if (Array.isArray(state.states)) {
      setStates(state.states);
    }
    if (typeof state.lastAction === "string") {
      setLastAction(state.lastAction);
    }
    if (typeof state.lastReason === "string") {
      setLastReason(state.lastReason);
    }
    if (typeof state.error === "string") {
      setError(state.error);
    }
  }, []);

  /**
   * Configures, then reads the whole state back.
   *
   * An edit to one branch changes what the others are allowed to say — the
   * schema naming the actions is rewritten whenever the actions change — so
   * there is nothing here that can be updated optimistically on its own.
   */
  const edit = useCallback(
    async (payload: object) => {
      await service.configure(payload);
      read(await service.getConfiguration?.());
    },
    [service, read],
  );

  /**
   * One branch, dressed as a service whose `pipeline` state and configure()
   * speak SubServicePipelineUI's protocol.
   */
  const branch = (name: string, label: string, pipeline: PipelineEntry[]): ServiceInstance =>
    ({
      uuid: `${service.uuid}-branch-${name}`,
      serviceId: "communication-dispatcher",
      serviceName: label,
      state: { pipeline },
      app: service.app,
      board: service.board,
      configure: async (config: any) => edit({ ...config, branch: name }),
      process: async () => {},
      getConfiguration: async () => ({ pipeline }),
      destroy: async () => {},
    }) as unknown as ServiceInstance;

  return (
    <RuntimeRestServiceUI {...props} onInit={read} onNotification={read} genericUI={false}>
      <div className="flex flex-col gap-3" style={{ minWidth: 320 }}>
        <InputField
          label="Goal"
          value={goal}
          isExpandable
          onChange={(value) => {
            setGoal(value);
            void edit({ goal: value });
          }}
        />
        <div style={DESCRIPTION_STYLE}>
          What the exchange is for. Given to the model with the states, the
          actions below, and everything the board put in front of this service.
        </div>

        {/* The manager's own turn. Whatever is in here is asked which action to
            take; the shape of the answer is written from the actions, so it is
            not something to configure by hand. */}
        <div className="flex flex-col gap-1">
          <span style={{ fontSize: 12 }}>Decide</span>
          <div className="pl-4">
            <SubServicePipelineUI
              service={branch("decide", "Decide", decide)}
              findServiceUI={findServiceUI}
              defaultCollapsed={true}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span style={{ fontSize: 12 }}>
            Actions{states.length > 0 ? ` · states: ${states.map((s) => s.name).join(", ")}` : ""}
          </span>
          {actions.map((action) => (
            <div key={action.name} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  {action.name}
                </span>
                <InputField
                  label=""
                  value={action.describe}
                  isExpandable
                  onChange={(value) => void edit({ branch: action.name, describe: value })}
                />
                <Button
                  className="hkp-svc-btn"
                  onClick={() => void edit({ removeAction: action.name })}
                >
                  Remove
                </Button>
              </div>
              {/* When this action is on the menu at all. An expression over the
                  input, so an action that cannot apply is never offered. */}
              <InputField
                label="available"
                value={action.available}
                onChange={(value) => void edit({ branch: action.name, available: value })}
              />
              <div className="pl-4">
                <SubServicePipelineUI
                  service={branch(action.name, action.name, action.pipeline)}
                  findServiceUI={findServiceUI}
                  defaultCollapsed={true}
                />
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <InputField
              label="New action"
              value={newAction}
              synced={false}
              onChange={setNewAction}
            />
            <Button
              className="hkp-svc-btn"
              disabled={!newAction}
              onClick={() => {
                void edit({ addAction: { name: newAction } });
                setNewAction("");
              }}
            >
              Add
            </Button>
          </div>
        </div>

        {/* What it decided last, and why — the thing worth watching on a board
            where nothing else says which way a conversation went. */}
        {lastAction && (
          <div style={DESCRIPTION_STYLE}>
            last: <span className="font-mono">{lastAction}</span>
            {lastReason ? ` — ${lastReason}` : ""}
          </div>
        )}
        {error && (
          <div style={{ fontSize: 12, color: "var(--hkp-error, #ef4444)" }}>{error}</div>
        )}
      </div>
    </RuntimeRestServiceUI>
  );
}
