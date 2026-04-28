import { FolderOpen } from "lucide-react";

import IconH from "hkp-frontend/src/components/Toolbar/assets/hkp-single-dot-h.svg?react";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";

import MeanderAppMenu from "./MeanderAppMenu";

type Props = {
  onOpenLoadDialog?: () => void;
};

export default function MeanderHeader({ onOpenLoadDialog }: Props) {
  return (
    <header className="flex items-center h-10 py-1 px-2 border-b border-t border-border bg-background shrink-0">
      <IconH className="stroke-[#333]" width={24} height={24} />

      <div className="ml-auto flex items-center gap-1">
        {onOpenLoadDialog && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onOpenLoadDialog}
          >
            <FolderOpen size={14} />
            Load board
          </Button>
        )}
        <MeanderAppMenu />
      </div>
    </header>
  );
}
