import { Message } from "semantic-ui-react";
import { createDescription } from "./factory";
import { BaseType } from "./types";

type Props = {
  description?: string | BaseType | Array<BaseType>;
  boardName: string;
};

export default function Description({ description, boardName }: Props) {
  if (!description) {
    return false;
  }
  const arr = Array.isArray(description) ? description : [description];
  return (
    <div style={{ margin: "10px 0px" }}>
      <Message
        style={{
          padding: "15px 30px",
          color: "#555",
          backgroundColor: "rgba(172, 200, 229, 0.01)",
        }}
      >
        <>
          {arr.map((item, idx) => createDescription({ boardName, item, idx }))}
        </>
      </Message>
    </div>
  );
}
