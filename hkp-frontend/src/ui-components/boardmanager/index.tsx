import { useState } from "react";

import { SavedBoard } from "../../types";
import Search from "@/ui-components/boardmanager/Search";
import BoardTable, {
  BoardManagerAction,
} from "@/ui-components/boardmanager/BoardTable";
import BoardTableNav from "./BoardTableNav";

export type AdditionalActionItem = {
  label: string;
  value: string;
  icon: any;
};

type Props = {
  title: string;
  boards: Array<SavedBoard>;
  additionalActions?: Array<AdditionalActionItem>;
  onAction: (board: SavedBoard, action: BoardManagerAction) => void;
};

export default function BoardManager({
  title,
  boards,
  additionalActions,
  onAction,
}: Props) {
  const [filter, setFilter] = useState("");
  const [pageOffset, setPageOffset] = useState(0);

  if (!boards || boards.length === 0) {
    return null;
  }

  const pageSize = 5;
  const filteredItems = boards.filter(
    (board) => !filter || board.name.indexOf(filter) !== -1
  );

  const paginatedItems =
    pageSize === undefined
      ? filteredItems
      : filteredItems.slice(pageOffset * pageSize, (pageOffset + 1) * pageSize);

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex items-center f-[90%]">
        <h2 className="whitespace-nowrap">{title}</h2>
        <div className="w-full text-center">
          <BoardTableNav
            numItems={filteredItems.length}
            pageSize={pageSize}
            pageOffset={pageOffset}
            setPageOffset={setPageOffset}
          />
        </div>
        <div className="ml-auto">
          <Search
            filter={filter}
            onChange={(newFilter) => setFilter(newFilter)}
          />
        </div>
      </div>

      <BoardTable
        boards={paginatedItems}
        className="h-full border"
        filter={filter}
        additionalActions={additionalActions}
        onAction={onAction}
      />
    </div>
  );
}
