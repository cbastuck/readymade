import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Trash } from "lucide-react";

import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import InputField from "hkp-frontend/src/components/shared/InputField";
import Button from "hkp-frontend/src/ui-components/Button";
import SubServicePipelineUI from "../../ui/SubServicePipelineUI";
import CopyButton from "hkp-frontend/src/ui-components/CopyButton";
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

const CARD_STYLE = {
  border: "1px solid hsl(var(--border))",
  borderRadius: 4,
} as const;

/** Marks the action the manager last chose. */
function ActiveDot({ isActive }: { isActive: boolean }) {
  if (!isActive) {
    return null;
  }
  return (
    <span
      title="last chosen"
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        flexShrink: 0,
        background: "var(--hkp-accent)",
      }}
    />
  );
}

/** One side of the exchange, as it went over the wire. */
function Transcript({ label, text }: { label: string; text: string }) {
  if (!text) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span style={DESCRIPTION_STYLE}>{label}</span>
        {/* A prompt is read somewhere else — pasted into a model, diffed
            against the last one — and the card it sits in suppresses selection
            for dragging, so taking it by hand is not an option. */}
        <CopyButton className="ml-auto" value={text} label={label} />
      </div>
      <pre
        className="font-mono"
        style={{
          fontSize: 11,
          margin: 0,
          padding: 6,
          maxHeight: 220,
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          background: "hsl(var(--muted))",
          borderRadius: 4,
          // The service card is unselectable so it can be dragged; this is
          // text to be read and taken, which is the exception to that.
          userSelect: "text",
        }}
      >
        {text}
      </pre>
    </div>
  );
}

export default function CommunicationDispatcherUI(props: ServiceUIProps) {
  const { service } = props;
  const [goal, setGoal] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const [decide, setDecide] = useState<PipelineEntry[]>([]);
  const [states, setStates] = useState<
    Array<{ name: string; describe: string }>
  >([]);
  const [lastAction, setLastAction] = useState("");
  const [lastReason, setLastReason] = useState("");
  const [error, setError] = useState("");
  const [newAction, setNewAction] = useState("");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [exchangeOpen, setExchangeOpen] = useState(false);
  // One action's fields at a time: the set of actions is the menu the
  // manager picks from, so the whole list stays readable while only the
  // one being edited is unfolded.
  const [openAction, setOpenAction] = useState<string | null>(null);

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
    // The question is only ever notified — it carries the whole conversation,
    // so the service does not keep it — while the answer arrives both ways:
    // in full on the pass that produced it, abbreviated in the state read back
    // afterwards. Preferring the full one keeps a reload from shortening what
    // is already on screen.
    if (typeof state.decidePrompt === "string") {
      setPrompt(state.decidePrompt);
    }
    if (typeof state.decideAnswer === "string") {
      setAnswer(state.decideAnswer);
    } else if (typeof state.lastAnswer === "string" && state.lastAnswer) {
      setAnswer((current) => current || state.lastAnswer);
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
  const branch = (
    name: string,
    label: string,
    pipeline: PipelineEntry[],
  ): ServiceInstance =>
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
    <RuntimeRestServiceUI
      {...props}
      onInit={read}
      onNotification={read}
      genericUI={false}
      initialSize={{ width: 460, height: undefined }}
    >
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
              levelLabel={`${service.serviceName} · decide`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span style={{ fontSize: 12 }}>
            Actions
            {states.length > 0
              ? ` · states: ${states.map((s) => s.name).join(", ")}`
              : ""}
          </span>
          {actions.map((action) => {
            const isOpen = openAction === action.name;
            return (
              <div
                key={action.name}
                className="flex flex-col"
                style={CARD_STYLE}
              >
                {/* Closed, a card says what the action is called and what it is
                    for — the two things that tell it from its neighbours. */}
                <div
                  className="flex items-center gap-2 px-2 py-1 cursor-pointer"
                  onClick={() => setOpenAction(isOpen ? null : action.name)}
                >
                  {isOpen ? (
                    <ChevronDown size={14} strokeWidth={1.5} />
                  ) : (
                    <ChevronRight size={14} strokeWidth={1.5} />
                  )}
                  <span
                    className="font-mono"
                    style={{ fontSize: 12, whiteSpace: "nowrap" }}
                  >
                    {action.name}
                  </span>
                  <ActiveDot isActive={lastAction === action.name} />
                  {!isOpen && (
                    <span
                      className="truncate"
                      style={{ ...DESCRIPTION_STYLE, minWidth: 0, flex: 1 }}
                    >
                      {action.describe}
                    </span>
                  )}
                  <Button
                    className="hkp-svc-btn hkp-svc-btn--icon ml-auto flex items-center text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${action.name}`}
                    title={`Remove ${action.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isOpen) {
                        setOpenAction(null);
                      }
                      void edit({ removeAction: action.name });
                    }}
                  >
                    <Trash size={14} strokeWidth={1.5} />
                  </Button>
                </div>

                {isOpen && (
                  <div className="flex flex-col gap-1 px-2 pb-2">
                    <InputField
                      label="describe"
                      value={action.describe}
                      isExpandable
                      onChange={(value) =>
                        void edit({ branch: action.name, describe: value })
                      }
                    />
                    {/* When this action is on the menu at all. An expression
                        over the input, so an action that cannot apply is never
                        offered. */}
                    <InputField
                      label="available"
                      value={action.available}
                      onChange={(value) =>
                        void edit({ branch: action.name, available: value })
                      }
                    />
                    <div className="pl-4">
                      <SubServicePipelineUI
                        service={branch(
                          action.name,
                          action.name,
                          action.pipeline,
                        )}
                        findServiceUI={findServiceUI}
                        defaultCollapsed={true}
                        // An action's name is only meaningful next to the
                        // dispatcher it belongs to — several on a board can
                        // each have a 'send'.
                        levelLabel={`${service.serviceName} · ${action.name}`}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

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
          <div className="flex items-start gap-2">
            <div
              style={{
                fontSize: 12,
                color: "var(--hkp-error, #ef4444)",
                // A failure names an address, a status and a service, and the
                // next thing done with it is pasting it somewhere; the card it
                // sits in suppresses selection so it can be dragged.
                userSelect: "text",
              }}
            >
              {error}
            </div>
            <CopyButton className="ml-auto" value={error} label="error" />
          </div>
        )}

        {/* The exchange behind the decision. A decision that did not parse, or
            parsed into the wrong action, is unreadable without the question it
            answered and the answer it gave — and neither is anywhere else on
            the board. */}
        {(prompt || answer) && (
          <div className="flex flex-col" style={CARD_STYLE}>
            <div
              className="flex items-center gap-2 px-2 py-1 cursor-pointer"
              onClick={() => setExchangeOpen(!exchangeOpen)}
            >
              {exchangeOpen ? (
                <ChevronDown size={14} strokeWidth={1.5} />
              ) : (
                <ChevronRight size={14} strokeWidth={1.5} />
              )}
              <span style={{ fontSize: 12 }}>Last exchange</span>
              <span
                className="truncate"
                style={{ ...DESCRIPTION_STYLE, minWidth: 0, flex: 1 }}
              >
                {answer}
              </span>
            </div>
            {exchangeOpen && (
              <div className="flex flex-col gap-2 px-2 pb-2">
                <Transcript label="asked" text={prompt} />
                <Transcript label="answered" text={answer} />
              </div>
            )}
          </div>
        )}
      </div>
    </RuntimeRestServiceUI>
  );
}
