import { useState, useRef } from "react";
import { Input, TextArea, Label } from "semantic-ui-react";

import Prompt, { PromptRefApi } from "./Prompt";
import { s, t } from "../styles";

export type SaveBoardApi = {
  acceptInput: (name: string, description: string) => Promise<boolean>;
  getValues: () => { name: string; description: string };
};

type Props = {
  onRef: (api: SaveBoardApi) => void;
};

export default function SaveBoardPrompt({ onRef }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const promptRef = useRef<PromptRefApi>();

  const acceptInput = async (name: string, description: string) => {
    setName(name);
    setDescription(description);
    return promptRef.current?.getInput() || false;
  };

  const getValues = () => ({ name, description });
  onRef({ acceptInput, getValues });

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
}
