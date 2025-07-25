import { ReactElement } from "react";
import {
  TableCell,
  TableRow,
} from "hkp-frontend/src/ui-components/primitives/table";

import { Badge } from "hkp-frontend/src/ui-components/primitives/badge";

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
      <TableCell>
        <Date
          className="text-left"
          month={month}
          day={day}
          year={year}
          size="m"
        />
      </TableCell>
      <TableCell>{content}</TableCell>
      <TableCell>
        <Badge variant={type}>{type}</Badge>
      </TableCell>
    </TableRow>
  );
}
