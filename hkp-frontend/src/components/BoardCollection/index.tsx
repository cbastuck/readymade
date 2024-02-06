import { ReactElement, useState } from "react";

import Collection from "./Collection";
import Search from "./Search";
import { s, t } from "../../styles";
import { SavedBoard, UsecaseDescriptor } from "../../types";
import { Action } from "./Card";

type Props = {
  items: Array<SavedBoard> | Array<UsecaseDescriptor>;
  headline?: string;
  renderBorder?: boolean;
  renderSearch?: boolean;
  actions?: Array<{ name: string; icon: ReactElement }>;
  onAction?: (action: Action, item: UsecaseDescriptor | SavedBoard) => void;
};

export default function BoardCollection({
  items,
  actions,
  onAction,
  headline = "",
  renderBorder = true,
  renderSearch = true,
}: Props) {
  const [filter, setFilter] = useState("");

  return (
    items.length > 0 && (
      <div
        className={renderBorder ? "hkp-card-border" : ""}
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          paddingBottom: "40px",
          marginBottom: "20px",
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
          {headline ? (
            <h1 style={s(t.mt15, t.tc, t.fs16, t.w100)}>{headline}</h1>
          ) : (
            <div style={{ height: "20px" }} />
          )}
        </div>
        <div
          style={{
            marginTop: "-30px",
            paddingBottom: "20px",
            marginRight: "15px",
          }}
        >
          {renderSearch && (
            <Search
              filter={filter}
              onChange={(newFilter) => setFilter(newFilter)}
            />
          )}
        </div>
        <Collection
          filter={filter}
          items={items}
          actions={actions}
          onAction={onAction}
        />
      </div>
    )
  );
}
