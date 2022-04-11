import React, { useEffect, useState } from "react";

import BoardCollection from "../../components/BoardCollection";

import { s, t } from "../../styles";

function getLocalBoards(prefix) {
  const savedBoards = [];
  for (const key in localStorage) {
    if (key.startsWith(prefix)) {
      const data = localStorage.getItem(key);
      savedBoards.push({
        name: key.substr(prefix.length),
        value: JSON.parse(data),
      });
    }
  }

  return savedBoards.map((item) => ({
    ...item,
    url: `/playground/${item.name}`,
    description: item.value.description,
  }));
}

export default function StoredBoards({ prefix = "" }) {
  const [items, setSavedBoards] = useState([]);
  useEffect(() => setSavedBoards(getLocalBoards(prefix)), [prefix]);

  return (
    items.length > 0 && (
      <div style={s(t.mt20)}>
        <BoardCollection
          style={{ width: "100%", marginRight: 20 }}
          headline="Saved boards in this browser"
          items={items}
          renderBorder={false}
        />
      </div>
    )
  );
}
