import { useState } from "react";
import { Modal, Button } from "semantic-ui-react";

import { s, t } from "../styles";

export type PromptRefApi = { getInput: () => Promise<boolean> };

type Props = {
  onRef: (api: PromptRefApi) => void;
  children?: JSX.Element | JSX.Element[];
  headline: string;
};

export default function Prompt({
  onRef,
  children,
  headline = "Headline missing",
}: Props) {
  const [open, setOpen] = useState(false);
  const [promise, setPromise] = useState<{ resolve: any; reject: any } | null>(
    null
  );

  const getInput = () => {
    return new Promise<boolean>((resolve, reject) => {
      setOpen(true);
      setPromise({ resolve, reject });
    });
  };
  onRef({ getInput });

  return (
    <Modal
      onClose={() => {
        setOpen(false);
        setPromise(null);
      }}
      onOpen={() => setOpen(true)}
      open={open}
      dimmer="inverted"
    >
      <Modal.Header style={s(t.fs12, t.ls1, t.uc)}>{headline}</Modal.Header>
      <Modal.Content>{children}</Modal.Content>
      <Modal.Actions>
        <Button
          style={s(t.fs12, t.ls1, t.uc)}
          onClick={() => {
            setOpen(false);
            promise?.resolve(false);
          }}
        >
          Cancel
        </Button>
        <Button
          style={s(t.uc, t.fs12, t.ls1)}
          onClick={() => {
            promise?.resolve(true);
            setOpen(false);
          }}
        >
          OK
        </Button>
      </Modal.Actions>
    </Modal>
  );
}
