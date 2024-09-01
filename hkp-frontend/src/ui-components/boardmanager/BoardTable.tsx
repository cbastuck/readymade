import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui-components/primitives/table";
import moment from "moment";
import { Link } from "react-router-dom";

import { SavedBoard } from "@/types";
import BoardActionButton from "./BoardActionButton";

import { AdditionalActionItem } from ".";

export type BoardManagerAction = {
  command: string;
};

type Props = {
  boards: Array<SavedBoard>;
  className?: string;
  filter?: string;
  pageSize?: number;
  additionalActions?: Array<AdditionalActionItem>;
  onAction: (board: SavedBoard, action: BoardManagerAction) => void;
};
export default function BoardTable({
  boards: items,
  className,
  additionalActions = [],
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
            <TableHead className="text-left text-base text-gray-600 w-[15%]">
              Date
            </TableHead>
            <TableHead className="text-right text-base text-gray-600 w-[5%]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((board) => (
            <TableRow key={board.name}>
              <TableCell className="text-left text-base whitespace-nowrap text-ellipsis">
                {<Link to={board.url}>{board.name}</Link>}
              </TableCell>
              <TableCell className="text-left text-base whitespace-nowrap text-ellipsis">
                {typeof board.description === "string"
                  ? board.description
                  : JSON.stringify(board.description)}
              </TableCell>
              <TableCell className="text-left text-base whitespace-nowrap text-ellipsis">
                {board.createdAt
                  ? moment(board.createdAt).format("DD/MM/YYYY hh:mm")
                  : "-"}
              </TableCell>
              <TableCell className="text-right text-base w-min">
                <BoardActionButton
                  board={board}
                  onAction={onAction}
                  additionalActions={additionalActions}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
