import { useState } from "react";
import { Modal } from "semantic-ui-react";

import Button from "./shared/Button";
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
      <Modal.Header className="hkp-fnt-family" style={s(t.fs14, t.ls1)}>
        {headline}
      </Modal.Header>
      <div style={{ padding: 10 }}>{children}</div>
      <div style={{ display: "flex", flexDirection: "row", margin: "10px" }}>
        <Button
          style={{ width: "100%" }}
          onClick={() => {
            setOpen(false);
            promise?.resolve(false);
          }}
        >
          Cancel
        </Button>
        <Button
          style={{ width: "100%" }}
          onClick={() => {
            promise?.resolve(true);
            setOpen(false);
          }}
        >
          Ok
        </Button>
      </div>
    </Modal>
  );
}
