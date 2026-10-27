import { DragEvent, useMemo, useRef, useState } from "react";
import { ChevronDown, Trash, X } from "lucide-react";

import MappingTable, {
  Template,
} from "hkp-frontend/src/components/MappingTable";
import { useBoardContext } from "hkp-frontend/src/BoardContext";
import {
  SavedPayload,
  isJsonFile,
  isTextFile,
  parseRunJson,
  readFileText,
  RunPayloadMode,
  useRunPayloads,
} from "hkp-frontend/src/core/runPayloads";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import { Checkbox } from "hkp-frontend/src/ui-components/primitives/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "hkp-frontend/src/ui-components/primitives/dropdown-menu";
import { Label } from "hkp-frontend/src/ui-components/primitives/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "hkp-frontend/src/ui-components/primitives/radio-group";
import { Textarea } from "hkp-frontend/src/ui-components/primitives/textarea";
import {
  SettingsButton,
  SettingsInput,
} from "hkp-frontend/src/ui-components/settings/kit";

type Props = {
  open: boolean;
  onClose: () => void;
  onRun: (params: unknown) => void;
  /** What receives the payload, as the description names it. */
  target?: string;
  /** Where to open, for a caller drawn over the app. See `DialogContent`. */
  container?: HTMLElement | null;
};

/** How the payload is written; see `RunPayloadMode`. */
type Mode = RunPayloadMode;

const MODES: { mode: Mode; label: string }[] = [
  { mode: "fields", label: "Fields" },
  { mode: "text", label: "Text" },
  { mode: "json", label: "JSON" },
  { mode: "file", label: "File" },
];

/** Code, not prose: no smart quotes, dashes, corrections or capitals. */
const codeInputProps = {
  spellCheck: false,
  autoCorrect: "off",
  autoCapitalize: "off",
  autoComplete: "off",
} as const;

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const carriesFiles = (event: DragEvent) =>
  Array.from(event.dataTransfer?.types ?? []).includes("Files");

export default function RunParamsDialog({
  open,
  onClose,
  onRun,
  target = "the first service",
  container,
}: Props) {
  const boardName = useBoardContext()?.boardName;
  const { payloads, save, remove } = useRunPayloads(boardName);

  const [mode, setMode] = useState<Mode>("fields");
  // Held apart, so looking at the other way of writing a payload and coming
  // back does not throw away what was written.
  const [template, setTemplate] = useState<Template>({});
  const [text, setText] = useState("");
  const [json, setJson] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const parsed = useMemo(() => parseRunJson(json), [json]);
  const jsonError = json.length > 0 && !parsed.ok ? parsed.error : null;

  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /**
   * Whether a JSON or text file opens in its editor rather than being sent as
   * a file. On by default: a test case kept in a file is usually one to read.
   */
  const [openInEditor, setOpenInEditor] = useState(true);
  /** The name being typed for a payload about to be saved; null when not. */
  const [savingAs, setSavingAs] = useState<string | null>(null);

  const onSubmit = () => {
    if (mode === "fields") {
      onRun(template);
    } else if (mode === "text") {
      onRun(text);
    } else if (mode === "json") {
      if (parsed.ok) {
        onRun(parsed.value);
      }
    } else if (file) {
      onRun(file);
    }
  };

  const canRun =
    mode === "fields" ||
    (mode === "text" && text.length > 0) ||
    (mode === "json" && parsed.ok) ||
    (mode === "file" && !!file);

  const loadFile = async (picked: File) => {
    if (!openInEditor || !isTextFile(picked)) {
      setFile(picked);
      setMode("file");
      return;
    }
    const content = await readFileText(picked);
    if (isJsonFile(picked)) {
      setJson(content);
      setMode("json");
    } else {
      setText(content);
      setMode("text");
    }
  };

  const onDrop = (event: DragEvent) => {
    if (!carriesFiles(event)) {
      return;
    }
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) {
      loadFile(dropped);
    }
  };

  const onDragOver = (event: DragEvent) => {
    if (carriesFiles(event)) {
      event.preventDefault();
      setDragging(true);
    }
  };

  const onDragLeave = (event: DragEvent) => {
    // Leaving for one of the dialog's own children is not leaving the dialog.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDragging(false);
    }
  };

  const loadSaved = (payload: SavedPayload) => {
    if (payload.mode === "fields") {
      setTemplate(payload.template);
    } else if (payload.mode === "text") {
      setText(payload.text);
    } else {
      setJson(payload.json);
    }
    setMode(payload.mode);
  };

  // A file is not kept: it may be any size, and what it is is on disk already.
  const canSave = mode !== "file" && canRun;

  const saveAs = () => {
    const name = savingAs?.trim();
    if (!name || mode === "file") {
      return;
    }
    save(
      mode === "fields"
        ? { name, mode, template }
        : mode === "text"
          ? { name, mode, text }
          : { name, mode, json },
    );
    setSavingAs(null);
  };

  return (
    <Dialog open={open} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent
        className={`sm:max-w-[480px] ${dragging ? "ring-2 ring-primary" : ""}`}
        container={container}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <DialogHeader>
          <DialogTitle>Run with parameters</DialogTitle>
          <DialogDescription>
            The input {target} is given. Run on its own gives it nothing.
          </DialogDescription>
        </DialogHeader>
        {/* What is written belongs with the row that saves and runs it, so the
            space before that row is less than the dialog keeps between parts. */}
        <div className="grid gap-4 pt-4 -mb-2">
          <RadioGroup
            className="flex gap-4"
            value={mode}
            onValueChange={(value: string) => setMode(value as Mode)}
          >
            {MODES.map(({ mode, label }) => (
              <div key={mode} className="flex items-center gap-2">
                <RadioGroupItem value={mode} id={`run-params-${mode}`} />
                <Label className="text-base" htmlFor={`run-params-${mode}`}>
                  {label}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {mode === "fields" ? (
            <MappingTable
              id="process-runtime-params"
              title="Params"
              template={template}
              onTemplateChanged={setTemplate}
            />
          ) : mode === "json" ? (
            <div className="grid gap-2">
              <Textarea
                aria-label="Run parameters as JSON"
                {...codeInputProps}
                className="min-h-[160px] font-mono text-base"
                placeholder="[{name: 'a'}, {name: 'b'}]"
                value={json}
                onChange={(event) => setJson(event.target.value)}
              />
              {jsonError && (
                <p
                  className={`text-xs ${
                    jsonError ? "text-red-500" : "text-muted-foreground"
                  }`}
                >
                  {jsonError}
                </p>
              )}
            </div>
          ) : mode === "text" ? (
            <div className="grid gap-2">
              <Textarea
                aria-label="Run parameters as text"
                {...codeInputProps}
                className="min-h-[160px] font-mono text-base"
                placeholder="Any text: a message, a prompt, a document…"
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            </div>
          ) : (
            <div className="grid gap-2">
              <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-input p-4 text-center text-sm">
                {file ? (
                  <>
                    <span className="font-medium break-all">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatSize(file.size)}
                      {file.type ? ` · ${file.type}` : ""}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFile(null)}
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground">
                      Drop a file here, or
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Choose a file
                    </Button>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  data-testid="run-params-file-input"
                  onChange={(event) => {
                    const picked = event.target.files?.[0];
                    if (picked) {
                      loadFile(picked);
                    }
                    // So picking the same file again is still a change.
                    event.target.value = "";
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="run-params-open-in-editor"
                  checked={openInEditor}
                  onCheckedChange={(checked) =>
                    setOpenInEditor(checked === true)
                  }
                />
                <Label className="text-sm" htmlFor="run-params-open-in-editor">
                  Open JSON and text files in the editor
                </Label>
              </div>
            </div>
          )}

          {payloads.length > 0 && (
            // A menu, not a select: loading is something done, not a value
            // held, so choosing the one just loaded loads it again — which is
            // how an edited payload goes back to what was saved.
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="-mt-2 h-10 justify-between"
                >
                  Load a saved payload…
                  <ChevronDown size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-[240px] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
              >
                {payloads.map((payload) => (
                  <DropdownMenuItem
                    key={payload.name}
                    className="flex items-center gap-2 text-base"
                    onSelect={() => loadSaved(payload)}
                  >
                    <span className="flex-1 truncate">{payload.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {MODES.find((m) => m.mode === payload.mode)?.label}
                    </span>
                    <button
                      type="button"
                      className="opacity-60 hover:opacity-100 hover:text-red-500"
                      title={`Forget “${payload.name}”`}
                      aria-label={`Forget ${payload.name}`}
                      // The item loads on pointer up as well as on click, so
                      // neither may reach it.
                      onPointerDown={(event) => event.stopPropagation()}
                      onPointerUp={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        remove(payload.name);
                      }}
                    >
                      <Trash size={14} />
                    </button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {/* In the settings kit's terms, as the settings and editor dialogs
            draw their actions; `hkp-set` carries the kit's colours. */}
        <DialogFooter className="hkp-set sm:justify-between sm:items-center gap-2">
          {savingAs === null ? (
            <SettingsButton
              disabled={!canSave}
              title={
                mode === "file"
                  ? "A file is not kept; open it again to run it again"
                  : "Keep this payload for this board, on this device"
              }
              onClick={() => setSavingAs("")}
            >
              Save
            </SettingsButton>
          ) : (
            <div className="flex items-center gap-2">
              <SettingsInput
                autoFocus
                aria-label="Payload name"
                placeholder="Name"
                // The kit sets the width, so a utility would only tie with it.
                style={{ width: 160 }}
                value={savingAs}
                onChange={(event) => setSavingAs(event.target.value)}
                onKeyDown={(event) => {
                  // An Enter that confirms a composed character is the input
                  // method's, not a request to save.
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    // Said to be handled, or the host beeps: a key event that
                    // reaches a native shell with its default intact is one
                    // nothing claimed (see FacadeChrome).
                    event.preventDefault();
                    saveAs();
                  }
                }}
                spellCheck={false}
              />
              <SettingsButton disabled={!savingAs.trim()} onClick={saveAs}>
                Save
              </SettingsButton>
              <button
                type="button"
                className="hkp-set-icon-btn hkp-set-icon-btn--neutral"
                aria-label="Cancel saving"
                onClick={() => setSavingAs(null)}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <SettingsButton
            variant="primary"
            onClick={onSubmit}
            disabled={!canRun}
          >
            Process
          </SettingsButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
