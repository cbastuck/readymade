import { ReactElement, useState } from "react";

import Collection from "./Collection";
import Search from "./Search";
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
  renderBorder = true,
  renderSearch = true,
}: Props) {
  const [filter, setFilter] = useState("");

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
          marginBottom: "0px",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            padding: "15px 0px",
          }}
        >
          {headline ? (
            <h2 className="w-full text-left">{headline}</h2>
          ) : (
            <div style={{ height: "20px" }} />
          )}

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
