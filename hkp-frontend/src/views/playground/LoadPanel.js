import React, { useEffect, useState } from "react";

import { localStoragePrefix, getLocalBoards } from "./common";
import { s, t } from "../../styles";
import BoardCollection from "../../components/BoardCollection";

export default function LoadPanel() {
  const [items, setSavedBoards] = useState([]);
  useEffect(() => setSavedBoards(getLocalBoards(localStoragePrefix)), []);

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div style={s(t.m(0, 20), t.tc)}>
      <SavedBoards items={items} />
    </div>
  );
}

function SavedBoards({ items }) {
  return (
    <div style={s(t.mt20, t.uc, { marginLeft: "2%" })}>
      <BoardCollection
        style={{ width: "100%" }}
        headline="Saved on this browser"
        items={items}
        renderBorder={false}
      />
    </div>
  );
}
