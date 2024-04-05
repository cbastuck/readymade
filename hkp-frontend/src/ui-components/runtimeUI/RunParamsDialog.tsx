import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onRun: (params: any) => void;
};

export default function RunParamsDialog({ open, onClose, onRun }: Props) {
  const [key, setKey] = useState("key");
  const [value, setValue] = useState("value");
  const onSubmit = () => {
    onRun({ [key]: value });
  };
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Key</Label>
            <Input
              value={key}
              onChange={(ev) => setKey(ev.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Value</Label>
            <Input
              value={value}
              onChange={(ev) => setValue(ev.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit}>Run</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
