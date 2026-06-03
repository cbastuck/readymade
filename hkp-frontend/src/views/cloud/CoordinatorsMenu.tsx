import { useState } from "react";
import { ChevronsUpDown, Settings } from "lucide-react";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandSeparator,
} from "hkp-frontend/src/ui-components/primitives/command";
import { CommandGroup, CommandList } from "cmdk";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "hkp-frontend/src/ui-components/primitives/popover";
import { CoordinatorDescriptor } from "../../common";
import { CoordinatorBoardInfo } from "./coordinatorClient";
import ManageCoordinatorsDialog from "./ManageCoordinatorsDialog";

type Props = {
  coordinators: CoordinatorDescriptor[];
  selectedCoordinator: CoordinatorDescriptor | undefined;
  boards: CoordinatorBoardInfo[];
  selectedBoard: CoordinatorBoardInfo | undefined;
  onSelectCoordinator: (coordinator: CoordinatorDescriptor) => void;
  onSelectBoard: (board: CoordinatorBoardInfo) => void;
  onAddCoordinator: (coordinator: CoordinatorDescriptor) => void;
  onRemoveCoordinator: (coordinator: CoordinatorDescriptor) => void;
  onNewBoard: () => void;
};

export default function CoordinatorsMenu({
  coordinators,
  selectedCoordinator,
  boards,
  selectedBoard,
  onSelectCoordinator,
  onSelectBoard,
  onAddCoordinator,
  onRemoveCoordinator,
  onNewBoard,
}: Props) {
  const [coordOpen, setCoordOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [showManageDialog, setShowManageDialog] = useState(false);

  const label = selectedCoordinator
    ? selectedBoard
      ? `${selectedCoordinator.name} / ${selectedBoard.boardName}`
      : selectedCoordinator.name
    : "Select Coordinator";

  return (
    <>
      {/* Coordinator + board picker */}
      <div className="flex items-center gap-2">
        <Popover open={coordOpen} onOpenChange={setCoordOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={coordOpen}
              className="w-[320px] justify-between text-base tracking-widest border-none bg-transparent"
            >
              {label}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0 font-menu">
            <Command>
              <CommandEmpty className="text-base p-2">
                No coordinators found
              </CommandEmpty>
              <CommandList>
                {coordinators.map((coord, idx) => (
                  <CommandItem
                    key={`${coord.name}-${idx}`}
                    className="text-base"
                    value={`${coord.name}|${idx}`}
                    onSelect={() => {
                      onSelectCoordinator(coord);
                      setCoordOpen(false);
                    }}
                  >
                    {coord.name}
                    <span className="ml-2 text-xs text-neutral-400 truncate">
                      {coord.url}
                    </span>
                  </CommandItem>
                ))}
              </CommandList>
              <CommandSeparator />
              <CommandGroup className="mt-auto">
                <CommandItem
                  className="flex gap-2 text-base"
                  onSelect={() => {
                    setCoordOpen(false);
                    setShowManageDialog(true);
                  }}
                >
                  <Settings size="18px" /> Manage Coordinators
                </CommandItem>
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Board picker — only shown when a coordinator is selected */}
        {selectedCoordinator && (
          <Popover open={boardOpen} onOpenChange={setBoardOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-[220px] justify-between text-base tracking-widest border-none bg-transparent"
              >
                {selectedBoard?.boardName ?? "Select Board"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0 font-menu">
              <Command>
                <CommandEmpty className="text-base p-2">
                  No boards yet
                </CommandEmpty>
                <CommandList>
                  {boards.map((board, idx) => (
                    <CommandItem
                      key={`${board.boardName}-${idx}`}
                      className="text-base"
                      value={`${board.boardName}|${idx}`}
                      onSelect={() => {
                        onSelectBoard(board);
                        setBoardOpen(false);
                      }}
                    >
                      {board.boardName}
                    </CommandItem>
                  ))}
                </CommandList>
                <CommandSeparator />
                <CommandGroup className="mt-auto">
                  <CommandItem
                    className="text-base"
                    onSelect={() => {
                      setBoardOpen(false);
                      onNewBoard();
                    }}
                  >
                    + New Board
                  </CommandItem>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <ManageCoordinatorsDialog
        isOpen={showManageDialog}
        coordinators={coordinators}
        onAdd={onAddCoordinator}
        onRemove={onRemoveCoordinator}
        onClose={() => setShowManageDialog(false)}
      />
    </>
  );
}
