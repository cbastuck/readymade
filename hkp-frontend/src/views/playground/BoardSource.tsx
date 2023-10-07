import React, { useState } from "react";
import { Button } from "semantic-ui-react";
import { useLocation, useNavigate } from "react-router-dom";
// import { compressSync, decompressSync, strToU8, strFromU8 } from "fflate";

import { localStoragePrefix } from "./common";
import Editor from "../../components/shared/Editor/index";
import { s, t } from "../../styles";
import { redirectTo } from "../../core/actions";
import { InfoNotification } from "../../components/Notifications";
import { withRouter } from "../../common";
import { importBoard } from "./BoardActions";
import { generateRandomName } from "../../core/board";

type Props = {
  editSourceCode: boolean;
  match: {
    params: any;
  };
};

export function decodeLink(compressedEncoded: string): string {
  /*
  const stillCompressed = new Uint8Array(
    atob(compressedEncoded)
      .split("")
      .map(function (c) {
        return c.charCodeAt(0);
      })
  );
  const inflated = strFromU8(decompressSync(stillCompressed));
  */
  const inflated = atob(compressedEncoded);
  return inflated;
}

function BoardSource({ editSourceCode = true, match: { params } }: Props) {
  const [editSourceCodeMode, setEditSourceCodeMode] = useState(editSourceCode);
  const [notification, setNotification] = React.useState<string | undefined>();
  const editor = React.useRef<any>();

  const onSave = () => {
    const src = editor.current?.getValue();
    storeBoardToLocalStorage(board, src);
    setNotification("Saved Successfully");
  };

  const navigateTo = useNavigate();

  const onCreateLink = (src: string) => {
    /*const compressed = compressSync(strToU8(src));
    const compressedB64Encoded = btoa(
      String.fromCharCode.apply(null, compressed as any)
    );*/
    const compressedB64Encoded = btoa(src);
    navigateTo(
      `/playground/${generateRandomName()}?fromLink=${compressedB64Encoded}`,
      {
        replace: false,
      }
    );
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

  const { board } = params;
  const srcParam = new URLSearchParams(location.search).get("src");
  const src = srcParam ? null : restoreBoardFromLocalStorage(board) || "";
  const [srcState, setSrcState] = useState(src);
  if (srcParam && srcState === null) {
    importBoard(srcParam).then((data) => {
      setSrcState(data);
    });
  }

  if (editSourceCodeMode) {
    return (
      <div style={{ height: "100%" }}>
        <Button style={s(t.m5, t.uc, t.ls1, t.fs12)} onClick={onSave}>
          Save
        </Button>
        <Button style={s(t.m5, t.uc, t.ls1, t.fs12)} onClick={closeSourceView}>
          Close
        </Button>
        <Button
          style={s(t.m5, t.uc, t.ls1, t.fs12)}
          onClick={() => onCreateLink(editor.current?.getValue())}
        >
          Link
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
          value={JSON.stringify(srcState || src, null, 2)}
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
          onClick={() => setEditSourceCodeMode(true)}
        >
          Edit
        </Button>
        <Button style={s(t.m5, t.uc, t.ls1, t.fs12)} onClick={closeSourceView}>
          Close
        </Button>
        <Button
          style={s(t.m5, t.uc, t.ls1, t.fs12)}
          onClick={() => onCreateLink(JSON.stringify(srcState || src, null, 2))}
        >
          Link
        </Button>
        <hr style={{ borderTop: "1px solid lightgray" }} />
      </div>
      <div style={{ fontFamily: "monospace", margin: 5 }}>
        <pre> {JSON.stringify(srcState || src, null, 2)} </pre>
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
