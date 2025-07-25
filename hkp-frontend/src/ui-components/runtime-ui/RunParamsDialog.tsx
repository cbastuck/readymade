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
import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onRun: (params: any) => void;
};

export default function RunParamsDialog({ open, onClose, onRun }: Props) {
  const [template, setTemplate] = useState<Template>({});

  const onSubmit = () => onRun(template);

  return (
    <Dialog open={open} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Run with parameters</DialogTitle>
          <DialogDescription>
            Provide parameters for injecting into the runtime
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <MappingTable
            id="process-runtime-params"
            title="Params"
            template={template}
            onTemplateChanged={setTemplate}
          />
        </div>
        <DialogFooter>
          <Button onClick={onSubmit}>Process Runtime</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
