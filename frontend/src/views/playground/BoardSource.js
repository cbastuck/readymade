import React from "react";
import { Button } from "semantic-ui-react";

import Editor from "../../components/shared/Editor/index";
import { s, t } from "../../styles";
import { redirectTo } from "../../core/actions";

function restoreBoardFromLocalStorage(name) {
  const storageName = name ? `hkp-playground-${name}` : "hkp-playground";
  const data = localStorage.getItem(storageName);
  if (data) {
    return JSON.parse(data);
  }
}

function storeBoardToLocalStorage(board, src) {
  localStorage.setItem(`hkp-playground-${board}`, src);
}

function closeSourceView() {
  const { pathname } = window.location;
  redirectTo(pathname.split("/").slice(0, -1).join("/"));
}

export default function Source({ editSourceCode = true, match: { params } }) {
  const { board } = params;
  const editor = React.useRef();
  const src = restoreBoardFromLocalStorage(board) || "";
  if (editSourceCode) {
    return (
      <div style={{ height: "100%" }}>
        <Button
          style={s(t.m5, t.uc, t.ls1, t.fs12)}
          onClick={() => {
            const src = editor.getValue();
            storeBoardToLocalStorage(board, src);
          }}
        >
          Save
        </Button>
        <Button style={s(t.m5, t.uc, t.ls1, t.fs12)} onClick={closeSourceView}>
          Close
        </Button>
        <Editor
          ref={editor}
          language="json"
          value={JSON.stringify(src, null, 2)}
        />
      </div>
    );
  }
  return (
    <div>
      <div
        style={{
          position: "sticky",
          top: 0,
          width: "100%",
          backgroundColor: "white",
        }}
      >
        <Button
          style={s(t.mt10, t.mh(5), t.uc, t.ls1, t.fs12)}
          onClick={() => this.setState({ editSourceCode: true })}
        >
          Edit
        </Button>
        <Button style={s(t.m5, t.uc, t.ls1, t.fs12)} onClick={closeSourceView}>
          Close
        </Button>
        <hr style={{ borderTop: "1px solid lightgray" }} />
      </div>
      <div style={{ fontFamily: "monospace", margin: 5 }}>
        <pre> {JSON.stringify(src, null, 2)} </pre>
      </div>
    </div>
  );
}
