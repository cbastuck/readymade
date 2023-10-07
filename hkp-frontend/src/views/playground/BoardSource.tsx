import React, { useState } from "react";
import { Button } from "semantic-ui-react";
import { useLocation } from "react-router-dom";

import { localStoragePrefix } from "./common";
import Editor from "../../components/shared/Editor/index";
import { s, t } from "../../styles";
import { redirectTo } from "../../core/actions";
import { InfoNotification } from "../../components/Notifications";
import { withRouter } from "../../common";
import { importBoard, importFromLink } from "./BoardActions";
import { createBoardLink } from "./BoardLink";

type Props = {
  editSourceCode: boolean;
  match: {
    params: any;
  };
};

function BoardSource({ editSourceCode = true, match: { params } }: Props) {
  const [editSourceCodeMode, setEditSourceCodeMode] = useState(editSourceCode);
  const [notification, setNotification] = React.useState<string | undefined>();
  const editor = React.useRef<any>();

  const onSave = () => {
    const src = editor.current?.getValue();
    storeBoardToLocalStorage(board, src);
    setNotification("Saved Successfully");
  };

  React.useEffect(() => {
    const keyListener = (e: any) => {
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

  const location = useLocation();
  const closeSourceView = () => {
    redirectTo(
      location.pathname.split("/").slice(0, -1).join("/") + location.search
    );
  };

  const [srcState, setSrcState] = useState<string | null>(null);

  const { board } = params;
  const queryParams = new URLSearchParams(location.search);
  if (srcState === null) {
    retrieveSource(board, queryParams).then((src) => setSrcState(src));
  }

  if (editSourceCodeMode) {
    return (
      <div style={{ height: "100%" }}>
        <Button style={s(t.m5, t.uc, t.ls1, t.fs12)} onClick={onSave}>
          Save
        </Button>

        <Button
          style={s(t.m5, t.uc, t.ls1, t.fs12)}
          onClick={() => createBoardLink(editor.current?.getValue())}
        >
          Link
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
        <Editor ref={editor} language="json" value={srcState} />
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
          onClick={() => setEditSourceCodeMode(true)}
        >
          Edit
        </Button>

        <Button
          style={s(t.m5, t.uc, t.ls1, t.fs12)}
          onClick={() => createBoardLink(JSON.stringify(srcState, null, 2))}
        >
          Link
        </Button>
        <Button style={s(t.m5, t.uc, t.ls1, t.fs12)} onClick={closeSourceView}>
          Close
        </Button>
        <hr style={{ borderTop: "1px solid lightgray" }} />
      </div>
      <div style={{ fontFamily: "monospace", margin: 5 }}>
        <pre> {srcState} </pre>
      </div>
    </div>
  );
}

export default withRouter(BoardSource);

function restoreBoardFromLocalStorage(name: string) {
  const storageName = name ? `${localStoragePrefix}${name}` : "hkp-playground";
  const data = localStorage.getItem(storageName);
  if (data) {
    return JSON.parse(data);
  }
}

function storeBoardToLocalStorage(board: string, src: string) {
  localStorage.setItem(`${localStoragePrefix}${board}`, src);
}

async function retrieveSource(
  board: string,
  queryParams: URLSearchParams
): Promise<string> {
  const srcParam = queryParams.get("src");
  const fromLinkParam = queryParams.get("fromLink");

  if (srcParam) {
    const src = await importBoard(srcParam);
    return JSON.stringify(src || "", null, 2);
  } else if (fromLinkParam) {
    const src = await importFromLink(fromLinkParam);
    return JSON.stringify(src || "", null, 2);
  } else {
    return JSON.stringify(restoreBoardFromLocalStorage(board) || "", null, 2);
  }
}
