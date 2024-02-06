import { useCallback, useContext, useEffect, useState } from "react";
import { Icon } from "semantic-ui-react";

import { s, t } from "../../styles";
import { AppCtx } from "../../AppContext";

import Toolbar from "../../components/Toolbar";
import Footer from "../../components/Footer";
import BoardCollection from "../../components/BoardCollection";
import { SavedBoard, UsecaseDescriptor, User } from "../../types";
import { makeRequest as getRequest } from "../../runtime/browser/services/CloudSource";
import { makeRequest as putRequest } from "../../runtime/browser/services/CloudSink";
import { getLocalBoards } from "../playground/common";
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

  const onLocalAction = useCallback(
    (action: Action, board: SavedBoard | UsecaseDescriptor) => {
      if (user) {
        putLocalBoard(board as SavedBoard, user);
      }
    },
    [user]
  );

  if (user && cloudBoards === null) {
    getCloudBoards(user).then(setCloudBoards);
  }

  return (
    <div
      style={s(t.fs12, t.ls1, t.m(25, 20), {
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      })}
    >
      <Toolbar />

      <BoardCollection
        headline="Local boards"
        items={localBoards || []}
        actions={[
          {
            name: "upload",
            icon: <Icon name="upload" />,
          },
        ]}
        onAction={onLocalAction}
      />
      <BoardCollection headline="Cloud boards" items={cloudBoards || []} />
      <Footer />
      <div style={{ minHeight: "10px" }} />
    </div>
  );
}
