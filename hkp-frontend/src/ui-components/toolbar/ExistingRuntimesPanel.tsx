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

import { RuntimeClass } from "hkp-frontend/src/types";
import { MoreHorizontal } from "lucide-react";
import { ColorPicker } from "../ColorPicker";

type Props = {
  remoteRuntimes: Array<RuntimeClass>;
  onRemoveRuntime: (rt: RuntimeClass) => void;
  onChangeRuntimeColor: (rt: RuntimeClass, color: string) => void;
};

export default function ExistingRuntimesPanel({
  remoteRuntimes,
  onRemoveRuntime,
  onChangeRuntimeColor,
}: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="tracking-widest font-sans text-md">
          <TableHead className="w-[100px]">Name</TableHead>
          <TableHead>Url</TableHead>
          <TableHead>Color</TableHead>
          <TableHead className="text-right ">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {remoteRuntimes.map((rt, idx) => (
          <TableRow key={`${rt.name}-${rt.url}-${idx}`}>
            <TableCell className="font-menu text-md">{rt.name}</TableCell>
            <TableCell className="font-menu text-md">{rt.url}</TableCell>
            <TableCell className="font-menu text-md">
              <ColorPicker
                showPaletteOnly={true}
                onChange={(color) => onChangeRuntimeColor(rt, color)}
                value={rt.color || "white"}
              />
            </TableCell>
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
