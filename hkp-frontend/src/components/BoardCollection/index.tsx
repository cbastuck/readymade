import { useState } from "react";

import Collection from "./Collection";
import Search from "./Search";
import { s, t } from "../../styles";
import { SavedBoard, UsecaseDescriptor } from "../../types";

type Props = {
  items: Array<UsecaseDescriptor | SavedBoard>;
  headline: string;
  renderBorder?: boolean;
  renderSearch?: boolean;
};

export default function BoardCollection({
  items,
  headline,
  renderBorder = true,
  renderSearch = true,
}: Props) {
  const [filter, setFilter] = useState("");

  const borderStyle = renderBorder
    ? {
        border: "solid 1px #ccc",
        borderRadius: 3,
      }
    : {};

  return (
    items.length > 0 && (
      <div
        style={{
          height: "100%",
          width: "100%",
          fontFamily: "Roboto",
          ...borderStyle,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            width: "100%",
            paddingTop: 15,
          }}
        >
          {headline && (
            <h1 style={s(t.mt15, t.tc, t.fs16, t.w100)}>{headline}</h1>
          )}
        </div>
        <div style={{ marginTop: -30 }}>
          {renderSearch && (
            <Search
              filter={filter}
              onChange={(newFilter) => setFilter(newFilter)}
            />
          )}
        </div>
        <Collection filter={filter} items={items} />
      </div>
    )
  );
}
