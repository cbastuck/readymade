import { useCallback, useContext, useEffect, useState } from "react";
import { CloudUpload, CloudDownload } from "lucide-react";

import { s, t } from "../../styles";
import { AppCtx } from "../../AppContext";

import Toolbar from "../../components/Toolbar";
import Footer from "hkp-frontend/src/components/Footer";
import BoardCollection from "../../components/BoardCollection";
import { SavedBoard, UsecaseDescriptor, User, isSavedBoard } from "../../types";
import { makeRequest as getRequest } from "../../runtime/browser/services/CloudSource";
import { makeRequest as putRequest } from "../../runtime/browser/services/CloudSink";
import { getLocalBoards, storeBoardToLocalStorage } from "../playground/common";
import { Action } from "../../components/BoardCollection/Card";

const resourceId = "hkp.cloud-board.v1.";

type DocumentResult = {
  data: any;
  resourceId: string;
};

async function getCloudBoards(user: User): Promise<Array<SavedBoard>> {
  const res = await getRequest(resourceId, user, false);
  if (res === null) {
    return [];
  }

  return res.map(({ data }: DocumentResult) => data);
}

async function putLocalBoard(board: SavedBoard, user: User) {
  const res = await putRequest(
    `${resourceId}${board.name}`,
    { message: board },
    user,
    "overwrite"
  );

  return res;
}

export default function Dashboard() {
  const [cloudBoards, setCloudBoards] = useState<SavedBoard[] | null>(null);
  const [localBoards, setLocalBoards] = useState<SavedBoard[] | null>(null);
  useEffect(() => setLocalBoards(getLocalBoards()), []);

  const appContext = useContext(AppCtx);
  const user = appContext?.user;

  const refreshCloudBoards = useCallback(
    () => user && getCloudBoards(user).then(setCloudBoards),
    [user]
  );

  if (user && cloudBoards === null) {
    refreshCloudBoards();
  }

  const onAction = useCallback(
    (action: Action, board: SavedBoard | UsecaseDescriptor) => {
      if (user && isSavedBoard(board)) {
        if (action.name === "upload") {
          putLocalBoard(board, user).then(refreshCloudBoards);
        } else if (action.name === "download") {
          storeBoardToLocalStorage(
            board.name,
            JSON.stringify(board.value ? board.value : board)
          );
          setLocalBoards(getLocalBoards());
        }
      }
    },
    [user, refreshCloudBoards]
  );

  return (
    <div
      style={s(t.fs12, t.ls1, {
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      })}
    >
      <Toolbar />

      <div className="flex flex-col gap-4 p-4">
        <BoardCollection
          headline="Local boards"
          items={localBoards || []}
          actions={[
            {
              name: "upload",
              icon: <CloudUpload />,
            },
          ]}
          onAction={onAction}
        />
        <BoardCollection
          headline="Cloud boards"
          items={cloudBoards || []}
          actions={[
            {
              name: "download",
              icon: <CloudDownload />,
            },
          ]}
          onAction={onAction}
        />
      </div>
      <Footer />
      <div style={{ minHeight: "10px" }} />
    </div>
  );
}
