import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "hkp-frontend/src/ui-components/primitives/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "hkp-frontend/src/ui-components/primitives/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { CoordinatorDescriptor } from "../../common";

type Props = {
  coordinators: CoordinatorDescriptor[];
  onRemove: (coordinator: CoordinatorDescriptor) => void;
};

export default function ExistingCoordinatorsPanel({ coordinators, onRemove }: Props) {
  if (coordinators.length === 0) {
    return (
      <p className="text-md font-menu text-neutral-400 py-2">
        No coordinators added yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="tracking-widest font-sans text-md">
          <TableHead className="w-[140px]">Name</TableHead>
          <TableHead>URL</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {coordinators.map((coord, idx) => (
          <TableRow key={`${coord.name}-${idx}`}>
            <TableCell className="font-menu text-md">{coord.name}</TableCell>
            <TableCell className="font-menu text-md">{coord.url}</TableCell>
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
                    onClick={() => onRemove(coord)}
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
