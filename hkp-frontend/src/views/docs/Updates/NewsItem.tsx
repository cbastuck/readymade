import { ReactElement } from "react";
import { TableCell, TableRow } from "@/components/ui/table";

import { Badge } from "@/components/ui/badge";

import moment from "moment";

import Date from "../../../components/Date";

type Props = {
  content: ReactElement;
  date: string;
  type?: "draft" | "done" | "fixed";
};
export default function NewsItem({ content, date, type = "done" }: Props) {
  const d = moment(date, "D.M.YYYY");
  const month = d.format("MMMM");
  const day = d.format("DD");
  const year = d.year().toString();

  return (
    <TableRow>
      <TableCell>{content}</TableCell>
      <TableCell>
        <Badge variant={type}>{type}</Badge>
      </TableCell>

      <TableCell className="text-left">
        <Date month={month} day={day} year={year} size="m" />
      </TableCell>
    </TableRow>
  );
}
