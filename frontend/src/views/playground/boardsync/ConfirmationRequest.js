import React from "react";
import { Button } from "semantic-ui-react";

import { s, t } from "../../../styles";

export default function ConfirmationRequest({ sender, onAccept, onReject }) {
  const style = s(t.uc, t.ls1, t.fs12);
  return (
    <>
      <div
        style={{
          ...style,
          padding: "5px 10px",
          marginRight: 5,
          textAlign: "left",
          width: "100%",
          border: "solid 1px lightgray",
          borderRadius: 2,
        }}
      >
        Sync request from: {sender}
      </div>
      <div style={{ marginLeft: "auto", width: "100%" }}>
        <Button style={style} onClick={onAccept}>
          Accept
        </Button>
        <Button style={style} onClick={onReject}>
          Reject
        </Button>
      </div>
    </>
  );
}
