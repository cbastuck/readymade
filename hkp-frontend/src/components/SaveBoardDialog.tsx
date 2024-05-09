import { useEffect, useState } from "react";
import SubmittableInput from "@/ui-components/SubmittableInput";
import { Textarea } from "@/ui-components/primitives/textarea";

import CustomDialog from "@/ui-components/CustomDialog";
import GroupLabel from "@/ui-components/GroupLabel";
import Button from "@/ui-components/Button";

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
          <Button className="w-full" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="w-full"
            onClick={() => onSave(name, description, name === suggestedName)}
          >
            Save
          </Button>
        </div>
      </div>
    </CustomDialog>
  );
  /*
  return (
    <Prompt
      onRef={(prompt) => (promptRef.current = prompt)}
      headline="Enter a name for the board"
    >
      <Label style={s(t.fs12, t.ls1)}>Name</Label>
      <Input
        style={s(t.w100)}
        value={name || ""}
        onChange={(_ev, { value: name }) => setName(name)}
      />
      <Label style={s(t.fs12, t.ls1, t.mt10)}>Description</Label>
      <TextArea
        style={s(t.w100, t.p10, {
          border: "solid 1px lightgray",
          resize: "none",
        })}
        value={description || ""}
        onChange={(_ev, { value: description }) =>
          setDescription(`${description}`)
        }
      />
    </Prompt>
  );
  */
}
