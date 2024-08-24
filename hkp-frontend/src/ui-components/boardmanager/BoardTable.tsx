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
import { useEffect, useState } from "react";
import Button from "../Button";

export type BoardManagerAction = {
  command: string;
};

type Props = {
  boards: Array<SavedBoard>;
  className?: string;
  filter?: string;
  pageSize?: number;
  onAction: (board: SavedBoard, action: BoardManagerAction) => void;
};
export default function BoardTable({
  boards: savedBoards,
  className,
  filter,
  pageSize = undefined,
  onAction,
}: Props) {
  const [pageOffset, setPageOffset] = useState(0);
  const filteredItems = savedBoards.filter(
    (board) => !filter || board.name.indexOf(filter) !== -1
  );
  const items =
    pageSize === undefined
      ? filteredItems
      : filteredItems.slice(pageOffset * pageSize, (pageOffset + 1) * pageSize);
  const numPages =
    pageSize === undefined ? 0 : Math.ceil(filteredItems.length / pageSize);

  console.log("NUMPAGES", numPages);

  const onPrevPage = () => setPageOffset(Math.max(0, pageOffset - 1));
  const onNextPage = () =>
    setPageOffset(Math.min(pageOffset + 1, numPages - 1));

  useEffect(() => {
    if (pageOffset >= numPages) {
      setPageOffset(numPages);
    }
  }, [numPages, pageOffset]);

  return (
    <div className={`${className} overflow-y-auto`}>
      <Table>
        <TableHeader className="sticky top-0 h-10 bg-white">
          <TableRow>
            <TableHead className="text-left text-base w-[40%]">
              Boardname
            </TableHead>
            <TableHead className="text-left text-base w-[40%]">
              Description
            </TableHead>
            <TableHead className="text-left text-base w-[15%]">Date</TableHead>
            <TableHead className="text-right text-base w-[5%]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((board) => (
            <TableRow key={board.name}>
              <TableCell className="text-left text-base whitespace-nowrap text-ellipsis">
                {<a href={board.url}>{board.name}</a>}
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
                <BoardActionButton board={board} onAction={onAction} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <hr />
      {pageSize !== undefined && (
        <div className="text-center">
          <Button className="m-1" size="sm" onClick={onPrevPage}>
            {"<"}
          </Button>
          <span className="text-sm mx-2">
            {pageOffset + 1}/{numPages}
          </span>
          <Button className="m-1" size="sm" onClick={onNextPage}>
            {">"}
          </Button>
        </div>
      )}
    </div>
  );
}
