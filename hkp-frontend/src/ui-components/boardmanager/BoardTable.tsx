import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "hkp-frontend/src/ui-components/primitives/table";
import moment from "moment";
import { Link } from "react-router-dom";

import { SavedBoard } from "hkp-frontend/src/types";
import BoardActionButton from "./BoardActionButton";

import { ActionItem } from ".";

export type BoardManagerAction = {
  command: string;
};

type Props = {
  boards: Array<SavedBoard>;
  className?: string;
  filter?: string;
  pageSize?: number;
  actions?: Array<ActionItem>;
  dateFormat?: string;
  hideDate?: boolean;
  onAction?: (board: SavedBoard, action: BoardManagerAction) => void;
};
export default function BoardTable({
  boards: items,
  className,
  dateFormat = "DD/MM/YYYY hh:mm",
  actions = [],
  hideDate,
  onAction,
}: Props) {
  return (
    <div className={`${className} overflow-y-auto`}>
      <Table>
        <TableHeader className="sticky top-0 h-10 bg-white">
          <TableRow>
            <TableHead className="text-left text-base text-gray-600 w-[40%]">
              Boardname
            </TableHead>
            <TableHead className="text-left text-base text-gray-600 w-[40%]">
              Description
            </TableHead>
            {!hideDate && (
              <TableHead className="text-left text-base text-gray-600 w-[15%]">
                Date
              </TableHead>
            )}

            <TableHead className="text-right text-base text-gray-600 w-[5%]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((board, idx) => (
            <TableRow key={`${board.name}.${idx}`}>
              <TableCell className="text-left text-base whitespace-nowrap text-ellipsis">
                {<Link to={board.url}>{board.name}</Link>}
              </TableCell>
              <TableCell className="text-left text-base whitespace-nowrap text-ellipsis">
                {typeof board.description === "string"
                  ? board.description
                  : JSON.stringify(board.description)}
              </TableCell>
              {!hideDate && (
                <TableCell className="text-left text-base whitespace-nowrap text-ellipsis">
                  {board.createdAt
                    ? moment(board.createdAt).format(dateFormat)
                    : "-"}
                </TableCell>
              )}
              <TableCell className="text-right text-base w-min">
                {actions.length > 0 && (
                  <BoardActionButton
                    board={board}
                    onAction={onAction}
                    actions={actions}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
