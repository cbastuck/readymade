import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui-components/primitives/table";
import moment from "moment";
import { Ellipsis } from "lucide-react";

import Button from "@/ui-components/Button";
import { SavedBoard } from "@/types";

type Props = {
  boards: Array<SavedBoard>;
  className?: string;
};
export default function BoardTable({ boards: savedBoards, className }: Props) {
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
            <TableHead className="text-right text-base w-[5%]">
              Action
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {savedBoards.map((board) => (
            <TableRow key={board.name}>
              <TableCell className="text-left text-base">
                {<a href={board.url}>{board.name}</a>}
              </TableCell>
              <TableCell className="text-left text-base">
                {board.description}
              </TableCell>
              <TableCell className="text-left text-base">
                {moment().format("DD/MM/YYYY hh:mm")}
              </TableCell>
              <TableCell className="text-right text-base w-min">
                <Button>
                  <Ellipsis />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
