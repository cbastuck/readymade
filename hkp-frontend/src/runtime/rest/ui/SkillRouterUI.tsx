import { useCallback, useEffect, useRef, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
import InputField from "hkp-frontend/src/components/shared/InputField";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import Switch from "hkp-frontend/src/ui-components/Switch";
import Button from "hkp-frontend/src/ui-components/Button";
import { Textarea } from "hkp-frontend/src/ui-components/primitives/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";

type PromptMessage = { role?: string; content?: string };

type Match = {
  matched: string | null;
  board?: string;
  payload?: Record<string, unknown>;
  durationMs?: number;
  reason?: string;
};

type SkillEditor = {
  index: number | null; // null = adding a new skill
  action: string;
  board: string;
  payloadText: string;
  error?: string;
};

const STATUS_COLORS: Record<string, string> = {
  idle: "#9ca3af",
  loading: "#f59e0b",
  routing: "var(--hkp-accent)",
  error: "#ef4444",
};

export default function SkillRouterUI(props: ServiceUIProps) {
  const [status, setStatus] = useState("idle");
  const [detail, setDetail] = useState("");
  const [backend, setBackend] = useState("server");
  const [serverUrl, setServerUrl] = useState("");
  const [model, setModel] = useState("");
  const [modelPath, setModelPath] = useState("");
  const [noMatch, setNoMatch] = useState("stop");
  const [stream, setStream] = useState(true);
  const [skills, setSkills] = useState<any[]>([]);
  const [editor, setEditor] = useState<SkillEditor | null>(null);
  const [prompt, setPrompt] = useState<PromptMessage[]>([]);
  const [output, setOutput] = useState("");
  const [streamDone, setStreamDone] = useState(true);
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState("");

  const logRef = useRef<HTMLPreElement | null>(null);

  const onUpdate = useCallback((msg: any) => {
    if (!msg || typeof msg !== "object") {
      return;
    }

    if (typeof msg.status === "string") {
      setStatus(msg.status);
      setDetail(typeof msg.detail === "string" ? msg.detail : "");
      if (msg.status === "routing") {
        // A new routing run begins — clear the previous one.
        setOutput("");
        setStreamDone(false);
        setMatch(null);
        setError("");
      }
    }
    if (Array.isArray(msg.lastPrompt)) {
      setPrompt(msg.lastPrompt);
    }
    if (typeof msg.streamText === "string") {
      setOutput(msg.streamText);
      if (msg.streamDone === true) {
        setStreamDone(true);
      }
    }
    if (typeof msg.lastOutput === "string" && msg.lastOutput) {
      // Covers stream: false and restores the last run on init.
      setOutput(msg.lastOutput);
      setStreamDone(true);
    }
    if ("matched" in msg) {
      setMatch(msg as Match);
    }
    if (msg.lastMatch && typeof msg.lastMatch === "object") {
      setMatch(msg.lastMatch as Match);
    }
    if (typeof msg.error === "string") {
      setError(msg.error);
    }

    if (typeof msg.backend === "string") {
      setBackend(msg.backend);
    }
    if (typeof msg.serverUrl === "string") {
      setServerUrl(msg.serverUrl);
    }
    if (typeof msg.model === "string") {
      setModel(msg.model);
    }
    if (typeof msg.modelPath === "string") {
      setModelPath(msg.modelPath);
    }
    if (typeof msg.noMatch === "string") {
      setNoMatch(msg.noMatch);
    }
    if (typeof msg.stream === "boolean") {
      setStream(msg.stream);
    }
    // The open editor dialog holds its own draft, so a state sync never
    // clobbers an edit in progress.
    if (Array.isArray(msg.skills)) {
      setSkills(msg.skills);
    }
  }, []);

  // Keep the process log pinned to the newest tokens while streaming.
  useEffect(() => {
    const el = logRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [output, match]);

  const configure = (patch: Record<string, unknown>) => {
    props.service.configure(patch);
  };

  const openEditor = (index: number | null) => {
    const skill = index === null ? null : skills[index];
    setEditor({
      index,
      action: typeof skill?.action === "string" ? skill.action : "",
      board: typeof skill?.board === "string" ? skill.board : "",
      payloadText: JSON.stringify(skill?.payload ?? {}, null, 2),
    });
  };

  const applyEditor = () => {
    if (!editor) {
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(editor.payloadText || "{}");
    } catch (err: any) {
      setEditor({ ...editor, error: `invalid JSON: ${err?.message ?? err}` });
      return;
    }
    if (
      payload === null ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      setEditor({ ...editor, error: "payload must be a JSON object" });
      return;
    }
    if (!editor.action.trim() || !editor.board.trim()) {
      setEditor({ ...editor, error: "action and board are required" });
      return;
    }

    const skill = {
      action: editor.action.trim(),
      board: editor.board.trim(),
      payload,
    };
    const next =
      editor.index === null
        ? [...skills, skill]
        : skills.map((s, i) => (i === editor.index ? skill : s));
    setSkills(next);
    configure({ skills: next });
    setEditor(null);
  };

  const deleteSkill = () => {
    if (!editor || editor.index === null) {
      return;
    }
    const next = skills.filter((_, i) => i !== editor.index);
    setSkills(next);
    configure({ skills: next });
    setEditor(null);
  };

  const isRouting = status === "routing";
  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.idle;
  const promptText = prompt
    .map((message) => `[${message.role ?? "?"}]\n${message.content ?? ""}`)
    .join("\n\n");
  const hasRun = promptText || output || isRouting;

  return (
    <RuntimeRestServiceUI
      {...props}
      onNotification={onUpdate}
      onInit={onUpdate}
      genericUI={false}
      initialSize={{ width: 360, height: undefined }}
    >
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${isRouting ? "animate-pulse" : ""}`}
            style={{ backgroundColor: statusColor }}
          />
          <span className="uppercase tracking-widest">{status}</span>
          {detail && <span className="opacity-60 truncate">{detail}</span>}
          {!isRouting && match?.durationMs !== undefined && (
            <span className="opacity-60 ml-auto">{match.durationMs} ms</span>
          )}
        </div>

        <pre
          ref={logRef}
          className="font-mono whitespace-pre-wrap break-all border border-gray-300 p-1.5 max-h-64 overflow-y-auto m-0"
        >
          {!hasRun && (
            <span className="opacity-50">
              no run yet — send a request through the pipeline
            </span>
          )}
          {promptText && `── prompt ──\n${promptText}\n\n`}
          {(output || isRouting) && "── generation ──\n"}
          {output}
          {!streamDone && (
            <span
              className="animate-pulse"
              style={{ color: "var(--hkp-accent)" }}
            >
              ▍
            </span>
          )}
          {match && !isRouting && (
            <>
              {"\n\n── decision ──\n"}
              {match.matched ? (
                <>
                  <span style={{ color: "var(--hkp-accent)" }}>
                    {match.matched}
                  </span>
                  {match.board ? ` → ${match.board}` : ""}
                  {match.payload && Object.keys(match.payload).length > 0
                    ? `\n${JSON.stringify(match.payload, null, 2)}`
                    : ""}
                </>
              ) : (
                `no match${match.reason ? ` — ${match.reason}` : ""}`
              )}
            </>
          )}
        </pre>

        {error && <div className="text-red-500 break-words">{error}</div>}

        <div>
          <div className="uppercase tracking-widest opacity-60 pb-1">
            Skills
          </div>
          <div className="flex flex-col gap-1">
            {skills.length === 0 && (
              <div className="opacity-50">no skills configured yet</div>
            )}
            {skills.map((skill, index) => (
              <button
                key={index}
                type="button"
                className="text-left w-full border border-gray-300 p-1.5 cursor-pointer bg-transparent hover:border-[var(--hkp-accent)]"
                onClick={() => openEditor(index)}
              >
                <div
                  className="font-semibold"
                  style={{ color: "var(--hkp-accent)" }}
                >
                  {typeof skill?.action === "string" ? skill.action : "?"}
                </div>
                <div className="opacity-60">
                  → {typeof skill?.board === "string" ? skill.board : "?"}
                </div>
                {Object.keys(skill?.payload ?? {}).length > 0 && (
                  <div className="opacity-40 truncate">
                    {Object.keys(skill.payload).join(", ")}
                  </div>
                )}
              </button>
            ))}
            <div>
              <Button className="hkp-svc-btn" onClick={() => openEditor(null)}>
                Add Skill
              </Button>
            </div>
          </div>
        </div>

        <details>
          <summary className="uppercase tracking-widest opacity-60 cursor-pointer select-none">
            Settings
          </summary>
          <div className="flex flex-col gap-1 pt-1">
            <SelectorField
              value={backend}
              label="Backend"
              options={{ server: "server", local: "local" }}
              onChange={({ value }) => {
                configure({ backend: value });
              }}
              labelStyle={{ textTransform: "capitalize", textAlign: "left" }}
              uppercaseKeys={false}
              uppercaseValues={false}
            />
            {backend === "server" ? (
              <>
                <InputField
                  label="Server URL"
                  value={serverUrl}
                  onChange={(value) => {
                    setServerUrl(value);
                    configure({ serverUrl: value });
                  }}
                />
                <InputField
                  label="Model"
                  value={model}
                  onChange={(value) => {
                    setModel(value);
                    configure({ model: value });
                  }}
                />
              </>
            ) : (
              <InputField
                label="Model Path"
                value={modelPath}
                onChange={(value) => {
                  setModelPath(value);
                  configure({ modelPath: value });
                }}
              />
            )}
            <SelectorField
              value={noMatch}
              label="No Match"
              options={{ stop: "stop", forward: "forward" }}
              onChange={({ value }) => {
                configure({ noMatch: value });
              }}
              labelStyle={{ textTransform: "capitalize", textAlign: "left" }}
              uppercaseKeys={false}
              uppercaseValues={false}
            />
            <Switch
              className="py-1"
              labelClassName="tracking-[1px] text-base2"
              title="stream live output"
              checked={stream}
              onCheckedChange={(checked) => {
                setStream(checked);
                configure({ stream: checked });
              }}
            />
          </div>
        </details>
      </div>

      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditor(null);
          }
        }}
      >
        <DialogContent className="max-w-md gap-3 text-xs">
          <DialogTitle className="text-sm uppercase tracking-widest">
            {editor?.index === null ? "New Skill" : "Edit Skill"}
          </DialogTitle>
          {editor && (
            <div className="flex flex-col gap-2">
              <InputField
                label="Action"
                value={editor.action}
                onChange={(value) => {
                  setEditor({ ...editor, action: value, error: undefined });
                }}
              />
              <InputField
                label="Board"
                value={editor.board}
                onChange={(value) => {
                  setEditor({ ...editor, board: value, error: undefined });
                }}
              />
              <div>
                <div className="uppercase tracking-widest opacity-60 pb-0.5">
                  Payload
                </div>
                <Textarea
                  className="font-mono text-xs min-h-[140px]"
                  value={editor.payloadText}
                  onChange={(event) => {
                    setEditor({
                      ...editor,
                      payloadText: event.target.value,
                      error: undefined,
                    });
                  }}
                />
                <div className="opacity-50 pt-0.5">
                  JSON object — keys are parameter names, values describe what
                  to extract from the request
                </div>
              </div>
              {editor.error && (
                <div className="text-red-500 break-words">{editor.error}</div>
              )}
            </div>
          )}
          <DialogFooter className="pt-1 sm:justify-between">
            <div>
              {editor !== null && editor.index !== null && (
                <Button
                  className="hkp-svc-btn text-red-500"
                  variant="ghost"
                  onClick={deleteSkill}
                >
                  Delete
                </Button>
              )}
            </div>
            <Button className="hkp-svc-btn" onClick={applyEditor}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RuntimeRestServiceUI>
  );
}
