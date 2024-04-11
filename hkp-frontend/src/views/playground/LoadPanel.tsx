import { useEffect, useState } from "react";

import { localStoragePrefix, getLocalBoards } from "./common";
import { s, t } from "../../styles";
import BoardCollection from "../../components/BoardCollection";
import { SavedBoard } from "../../types";

export default function LoadPanel() {
  const [savedBoards, setSavedBoards] = useState<Array<SavedBoard>>([]);
  useEffect(() => setSavedBoards(getLocalBoards(localStoragePrefix)), []);

  if (!savedBoards || savedBoards.length === 0) {
    return null;
  }

  return (
    <div style={s(t.m(0, 20))}>
      <BoardCollection
        headline="Saved on this browser"
        items={savedBoards}
        renderBorder={false}
      />
    </div>
  );
}
