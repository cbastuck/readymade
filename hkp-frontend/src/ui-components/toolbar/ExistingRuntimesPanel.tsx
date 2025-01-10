import { Button } from "@/ui-components/primitives/button";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui-components/primitives/table";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui-components/primitives/dropdown-menu";

import { RuntimeClass } from "@/types";
import { MoreHorizontal } from "lucide-react";

type Props = {
  remoteRuntimes: Array<RuntimeClass>;
  onRemoveRuntime: (rt: RuntimeClass) => void;
};

export default function ExistingRuntimesPanel({
  remoteRuntimes,
  onRemoveRuntime,
}: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="tracking-widest font-sans text-md">
          <TableHead className="w-[100px]">Name</TableHead>
          <TableHead>Url</TableHead>
          <TableHead className="text-right ">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {remoteRuntimes.map((rt) => (
          <TableRow key={`${rt.name}-${rt.url}`}>
            <TableCell className="font-menu text-md">{rt.name}</TableCell>
            <TableCell className="font-menu text-md">{rt.url}</TableCell>

            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="tracking-widest"
                    onClick={() => onRemoveRuntime(rt)}
                  >
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
