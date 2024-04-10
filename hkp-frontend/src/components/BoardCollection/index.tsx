import { CSSProperties, ReactElement, useState } from "react";

import Collection from "./Collection";
import Search from "./Search";
import { s, t } from "../../styles";
import { AppViewMode, SavedBoard, UsecaseDescriptor } from "../../types";
import { Action } from "./Card";

type Props = {
  items: Array<SavedBoard> | Array<UsecaseDescriptor>;
  headline?: string;
  renderBorder?: boolean;
  renderSearch?: boolean;
  appViewMode?: AppViewMode;
  actions?: Array<{ name: string; icon: ReactElement }>;
  onAction?: (action: Action, item: UsecaseDescriptor | SavedBoard) => void;
};

export default function BoardCollection({
  items,
  actions,
  onAction,
  headline = "",
  appViewMode = "wide",
  renderBorder = true,
  renderSearch = true,
}: Props) {
  const [filter, setFilter] = useState("");

  const headlinePlacement: CSSProperties =
    appViewMode === "wide"
      ? { textAlign: "center" }
      : { textAlign: "left", paddingLeft: "10px" };

  return (
    items.length > 0 && (
      <div
        className={renderBorder ? "hkp-collection-border" : ""}
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          paddingBottom: "20px",
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
            <h4 style={headlinePlacement}>{headline}</h4>
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
