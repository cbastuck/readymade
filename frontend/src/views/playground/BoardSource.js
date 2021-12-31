import React from "react";
import { Button } from "semantic-ui-react";

import { localStoragePrefix } from "./common";
import Editor from "../../components/shared/Editor/index";
import { s, t } from "../../styles";
import { redirectTo } from "../../core/actions";
import { InfoNotification } from "../../components/Notifications";

function restoreBoardFromLocalStorage(name) {
  const storageName = name ? `${localStoragePrefix}${name}` : "hkp-playground";
  const data = localStorage.getItem(storageName);
  if (data) {
    return JSON.parse(data);
  }
}

function storeBoardToLocalStorage(board, src) {
  localStorage.setItem(`${localStoragePrefix}${board}`, src);
}

function closeSourceView() {
  const { pathname } = window.location;
  redirectTo(pathname.split("/").slice(0, -1).join("/"));
}

export default function BoardSource({
  editSourceCode = true,
  match: { params },
}) {
  const [notification, setNotification] = React.useState(undefined);
  const editor = React.useRef();
  const onSave = () => {
    const src = editor.current.getValue();
    storeBoardToLocalStorage(board, src);
    setNotification("Saved Successfully");
  };
  React.useEffect(() => {
    const keyListener = (e) => {
      if (
        (window.navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey) &&
        e.keyCode === 83
      ) {
        e.preventDefault();
        onSave();
      }
    };
    document.addEventListener("keydown", keyListener, false);
    return () => document.removeEventListener("keydown", keyListener);
  });
  const { board } = params;
  const src = restoreBoardFromLocalStorage(board) || "";
  if (editSourceCode) {
    return (
      <div style={{ height: "100%" }}>
        <Button style={s(t.m5, t.uc, t.ls1, t.fs12)} onClick={onSave}>
          Save
        </Button>
        <Button style={s(t.m5, t.uc, t.ls1, t.fs12)} onClick={closeSourceView}>
          Close
        </Button>
        <InfoNotification
          style={{ marginBottom: 5 }}
          title="Info"
          message={notification}
          onClose={() => setNotification(undefined)}
        />
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
        <pre> {JSON.stringify(src, null, 2)} </pre>
      </div>
    </div>
  );
}
