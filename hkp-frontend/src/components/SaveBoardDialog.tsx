import { useEffect, useState } from "react";
import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";
import { Textarea } from "hkp-frontend/src/ui-components/primitives/textarea";

import CustomDialog from "hkp-frontend/src/ui-components/CustomDialog";
import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";
import Button from "hkp-frontend/src/ui-components/Button";

type Props = {
  suggestedName: string;
  suggestedDescription: string;
  isOpen: boolean;
  onSave: (name: string, description: string, isSuggestedName: boolean) => void;
  onCancel: () => void;
};

export default function SaveBoardDialog({
  suggestedName,
  suggestedDescription,
  isOpen,
  onSave,
  onCancel,
}: Props) {
  const [name, setName] = useState(suggestedName);
  const [description, setDescription] = useState(suggestedDescription);

  useEffect(() => {
    if (!isOpen) {
      setName(suggestedName);
    }
  }, [isOpen, suggestedName]);

  useEffect(() => {
    if (!isOpen) {
      setDescription(suggestedDescription);
    }
  }, [isOpen, suggestedDescription]);

  const onOpenChange = (newIsOpen: boolean) => {
    if (newIsOpen === false) {
      onCancel();
    }
  };

  return (
    <CustomDialog
      title="Give the Board a Name"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <div className="text-base flex flex-col gap-2 h-full w-full">
        <SubmittableInput
          fullWidth
          title="Name"
          value={name}
          onSubmit={setName}
        />
        <GroupLabel size={3}>Description</GroupLabel>
        <Textarea
          className="h-full text-base font-serif"
          style={{ resize: "none" }}
          value={description || ""}
          onChange={(ev) => setDescription(ev.target.value)}
        />
        <div className="flex gap-2">
          <Button className="w-full tracking-widest" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="w-full tracking-widest"
            onClick={() => onSave(name, description, name === suggestedName)}
          >
            Save
          </Button>
        </div>
      </div>
    </CustomDialog>
  );
}
