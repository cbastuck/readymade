import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { SavedBoard } from "../../types";
import Search from "hkp-frontend/src/ui-components/boardmanager/Search";
import BoardTable, {
  BoardManagerAction,
} from "hkp-frontend/src/ui-components/boardmanager/BoardTable";
import BoardTableNav from "./BoardTableNav";
import IconButton from "../IconButton";
import moment from "moment";

export type ActionItem = {
  label: string;
  value: string;
  icon: any;
};

type Props = {
  title?: string;
  boards: Array<SavedBoard>;
  actions?: Array<ActionItem>;
  pageSize?: number;
  hideSearch?: boolean;
  startCollapsed?: boolean;
  dateFormat?: string;
  hideDate?: boolean;
  onAction?: (board: SavedBoard, action: BoardManagerAction) => void;
};

export default function BoardManager({
  title,
  boards,
  actions,
  pageSize,
  hideSearch,
  startCollapsed,
  dateFormat,
  hideDate,
  onAction,
}: Props) {
  const [filter, setFilter] = useState("");
  const [pageOffset, setPageOffset] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(startCollapsed);

  if (!boards || boards.length === 0) {
    return null;
  }

  const filteredItems = boards.filter(
    (board) => !filter || board.name.indexOf(filter) !== -1
  );

  const sortedByAge = filteredItems
    .map((x) => ({ ...x, age: moment().diff(x.createdAt || moment("1979")) }))
    .sort((a, b) => a.age - b.age);

  const paginatedItems =
    pageSize === undefined
      ? sortedByAge
      : sortedByAge.slice(pageOffset * pageSize, (pageOffset + 1) * pageSize);

  const isCollapsable = isCollapsed !== undefined;
  const onToggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex items-center f-[90%] overflow-auto">
        <h2
          className={`whitespace-nowrap pl-1 text-xl my-2 ${
            isCollapsable ? "cursor-pointer" : ""
          }`}
          onClick={isCollapsable ? onToggleCollapse : undefined}
        >
          {title}
        </h2>
        {isCollapsable && (
          <IconButton
            className="mx-2"
            icon={isCollapsed ? ChevronDown : ChevronUp}
            onClick={onToggleCollapse}
            border
          />
        )}
        <div className="w-full text-center">
          <BoardTableNav
            numItems={filteredItems.length}
            pageSize={pageSize}
            pageOffset={pageOffset}
            setPageOffset={setPageOffset}
          />
        </div>
        <div className="ml-auto">
          {!hideSearch && (
            <Search
              filter={filter}
              onChange={(newFilter) => setFilter(newFilter)}
            />
          )}
        </div>
      </div>
      {!isCollapsed && (
        <BoardTable
          boards={paginatedItems}
          className="h-full border"
          filter={filter}
          dateFormat={dateFormat}
          actions={actions}
          hideDate={hideDate}
          onAction={onAction}
        />
      )}
    </div>
  );
}
