import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui-components/primitives/table";
import moment from "moment";

import { SavedBoard } from "@/types";
import BoardActionButton from "./BoardActionButton";

export type BoardManagerAction = {
  command: string;
};

type Props = {
  boards: Array<SavedBoard>;
  className?: string;
  filter?: string;

  onAction: (board: SavedBoard, action: BoardManagerAction) => void;
};
export default function BoardTable({
  boards: savedBoards,
  className,
  filter,
  onAction,
}: Props) {
  return (
    <div className={`${className} overflow-y-auto`}>
      <Table>
        <TableHeader className="sticky top-0 h-10 bg-white">
          <TableRow>
            <TableHead className="text-left text-base w-[20%]">
              Boardname
            </TableHead>
            <TableHead className="text-left text-base w-[60%]">
              Description
            </TableHead>
            <TableHead className="text-left text-base w-[15%]">Date</TableHead>
            <TableHead className="text-right text-base w-[5%]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {savedBoards
            .filter((board) => !filter || board.name.indexOf(filter) !== -1)
            .map((board) => (
              <TableRow key={board.name}>
                <TableCell className="text-left text-base">
                  {<a href={board.url}>{board.name}</a>}
                </TableCell>
                <TableCell className="text-left text-base">
                  {typeof board.description === "string"
                    ? board.description
                    : JSON.stringify(board.description)}
                </TableCell>
                <TableCell className="text-left text-base">
                  {board.createdAt
                    ? moment(board.createdAt).format("DD/MM/YYYY hh:mm")
                    : "-"}
                </TableCell>
                <TableCell className="text-right text-base w-min">
                  <BoardActionButton board={board} onAction={onAction} />
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
