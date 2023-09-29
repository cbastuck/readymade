import { useEffect, useState } from "react";

import { localStoragePrefix, getLocalBoards } from "./common";
import { s, t } from "../../styles";
import BoardCollection from "../../components/BoardCollection";
import { SavedBoard } from "../../types";

export default function LoadPanel() {
  const [items, setSavedBoards] = useState<Array<SavedBoard>>([]);
  useEffect(() => setSavedBoards(getLocalBoards(localStoragePrefix)), []);

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div style={s(t.m(0, 20), t.tc)}>
      <div style={s(t.mt20, t.uc)}>
        <BoardCollection
          style={{ width: "100%" }}
          headline="Saved in this browser"
          items={items}
          renderBorder={false}
        />
      </div>
    </div>
  );
}
