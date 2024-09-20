import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "hkp-frontend/src/ui-components/primitives/table";

type Props = {
  className?: string;
  columns: Array<string>;
  rows: Array<Array<string>>;
};

export default function SimpleTable({ className, rows, columns }: Props) {
  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          {columns.map((c, idx) => (
            <TableHead
              key={`head-${idx}`}
              className="font-sans font-bold tracking-widest text-lg font-menu text-left px-4"
            >
              {c}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, ridx) => (
          <TableRow key={`row-${ridx}`} className="font-menu text-lg ">
            {row.map((cell, cidx) => (
              <TableCell
                key={`cell-${ridx}-${cidx}`}
                className="text-left py-4 px-4"
              >
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
