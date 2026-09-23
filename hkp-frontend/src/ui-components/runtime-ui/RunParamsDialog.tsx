import { useState } from "react";

import MappingTable, {
  Template,
} from "hkp-frontend/src/components/MappingTable";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import { Label } from "hkp-frontend/src/ui-components/primitives/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "hkp-frontend/src/ui-components/primitives/radio-group";
import { Textarea } from "hkp-frontend/src/ui-components/primitives/textarea";

type Props = {
  open: boolean;
  onClose: () => void;
  onRun: (params: unknown) => void;
  /** What receives the payload, as the description names it. */
  target?: string;
  /** Where to open, for a caller drawn over the app. See `DialogContent`. */
  container?: HTMLElement | null;
};

/**
 * How the payload is written, not what it is.
 *
 * Fields build an object a name at a time, which is what most services read.
 * Text is the payload itself — a request body pasted from an API's reference
 * manual, a document, anything whose shape is not a flat map of names to
 * values. Building one of those a row at a time is not possible, and quoting
 * it into a single field is not something anyone should be asked to do.
 */
type Mode = "fields" | "text";

export default function RunParamsDialog({
  open,
  onClose,
  onRun,
  target = "the first service",
  container,
}: Props) {
  const [mode, setMode] = useState<Mode>("fields");
  // Held apart, so looking at the other way of writing a payload and coming
  // back does not throw away what was written.
  const [template, setTemplate] = useState<Template>({});
  const [text, setText] = useState("");

  const onSubmit = () => onRun(mode === "fields" ? template : text);

  return (
    <Dialog open={open} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]" container={container}>
        <DialogHeader>
          <DialogTitle>Run with parameters</DialogTitle>
          <DialogDescription>
            The input {target} is given. Run on its own gives it nothing.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <RadioGroup
            className="flex gap-4"
            value={mode}
            onValueChange={(value: string) => setMode(value as Mode)}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="fields" id="run-params-fields" />
              <Label className="text-base" htmlFor="run-params-fields">
                Fields
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="text" id="run-params-text" />
              <Label className="text-base" htmlFor="run-params-text">
                Text
              </Label>
            </div>
          </RadioGroup>

          {mode === "fields" ? (
            <MappingTable
              id="process-runtime-params"
              title="Params"
              template={template}
              onTemplateChanged={setTemplate}
            />
          ) : (
            <div className="grid gap-2">
              <Textarea
                aria-label="Run parameters as text"
                className="min-h-[160px] font-mono text-sm"
                placeholder={'{"model": "…", "messages": [ … ]}'}
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Sent exactly as typed, as text. Nothing here is parsed, so a
                service that expects an object will not get one.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={onSubmit}
            disabled={mode === "text" && text.length === 0}
          >
            Process Runtime
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
