import { useState } from "react";
import { Menu, Trash2, Settings, Share } from "lucide-react";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";
import Icon from "hkp-frontend/src/ui-components/Icon";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "hkp-frontend/src/ui-components/primitives/dropdown-menu";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import EditorDialog from "hkp-frontend/src/ui-components/EditorDialog";
import ShareQRCodeDialog from "../ShareQRCodeDialog";
import { BoardDescriptor } from "hkp-frontend/src/types";
import { compressAndEncodeState } from "hkp-frontend/src/common";

type Props = {
  removable?: boolean;
  params?: any;
  board: BoardDescriptor;
  onRemoveWidget?: () => void;
  onConfig?: (cfg: any) => void;
};

export default function BoardWidgetSettings({
  removable,
  params,
  board,
  onRemoveWidget,
  onConfig,
}: Props) {
  const onApplyConfig = onConfig
    ? (buf: string | object) => {
        const cfg = typeof buf === "string" ? JSON.parse(buf) : buf;
        onConfig(cfg);
        setIsConfigEditorOpen(false);
      }
    : undefined;

  const [isConfigEditorOpen, setIsConfigEditorOpen] = useState(false);
  const onCloseConfigEditor = () => setIsConfigEditorOpen(false);

  const [isQRCodeDialogOpen, setIsQRCodeDialogOpen] = useState(false);
  const onShareWidget = () => setIsQRCodeDialogOpen(true);
  const onCloseQRCodeDialog = () => setIsQRCodeDialogOpen(false);

  const shareWidgetPayload = isQRCodeDialogOpen && {
    board,
    params,
  };
  const shareWidgetUrl =
    isQRCodeDialogOpen &&
    `${window.location.origin}/home/import-widget?src=${compressAndEncodeState(
      JSON.stringify(shareWidgetPayload)
    )}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="p-0 h-min w-min" variant="ghost" size="icon">
            <Icon className="mt-0.5" value={Menu} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 font-menu">
          <DropdownMenuItem
            className="text-base"
            onClick={() => setIsConfigEditorOpen(true)}
            disabled={!removable}
          >
            <MenuIcon icon={Settings} />
            <span>Configure</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="text-base"
            onClick={onShareWidget}
            disabled={!removable}
          >
            <MenuIcon icon={Share} />
            <span>Share widget</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-base"
            onClick={onRemoveWidget}
            disabled={!removable}
          >
            <MenuIcon icon={Trash2} />
            <span>Remove Widget from Home</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditorDialog
        isOpen={isConfigEditorOpen}
        title="Enter widget parameters"
        value={params}
        actions={
          onApplyConfig ? [{ label: "Apply", onAction: onApplyConfig }] : []
        }
        onClose={onCloseConfigEditor}
      />

      <ShareQRCodeDialog
        isOpen={isQRCodeDialogOpen}
        title="Scan to import Widget"
        url={shareWidgetUrl || ""}
        onClose={onCloseQRCodeDialog}
      />
    </>
  );
}
