import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import { Input } from "hkp-frontend/src/ui-components/primitives/input";
import { Label } from "hkp-frontend/src/ui-components/primitives/label";

type Props = {
  isOpen: boolean;
  coordinatorName?: string;
  existingBoardNames: string[];
  onCreate: (boardName: string) => void;
  onClose: () => void;
};

export default function NewBoardDialog({
  isOpen,
  coordinatorName,
  existingBoardNames,
  onCreate,
  onClose,
}: Props) {
  const [name, setName] = useState("");

  // Reset the field each time the dialog opens.
  useEffect(() => {
    if (isOpen) {
      setName("");
    }
  }, [isOpen]);

  const trimmed = name.trim();
  const isDuplicate = existingBoardNames.includes(trimmed);
  const canCreate = trimmed.length > 0 && !isDuplicate;

  const onSubmit = () => {
    if (!canCreate) {
      return;
    }
    onCreate(trimmed);
  };

  const onChangeDialogOpen = (newOpen: boolean) => {
    if (!newOpen) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onChangeDialogOpen}>
      <DialogContent className="sm:max-w-[440px] flex flex-col gap-4">
        <DialogTitle className="text-lg font-semibold tracking-widest">
          New Board
        </DialogTitle>
        {coordinatorName && (
          <p className="text-sm text-muted-foreground -mt-2">
            on {coordinatorName}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Label
            htmlFor="new-board-name"
            className="text-left font-sans text-md tracking-widest"
          >
            Board name
          </Label>
          <Input
            id="new-board-name"
            autoFocus
            // text-base (16px): keep ≥16px so iOS Safari/WKWebView doesn't
            // auto-zoom the viewport when the field is focused.
            className="font-menu text-base"
            placeholder="My Board"
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                onSubmit();
              }
            }}
            spellCheck={false}
          />
          {isDuplicate && (
            <p className="text-sm text-red-500">
              A board with this name already exists.
            </p>
          )}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button className="text-md" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button className="text-md" onClick={onSubmit} disabled={!canCreate}>
            Create Board
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
