import { useState } from "react";
import { Menu, Trash2, Settings } from "lucide-react";
import MenuIcon from "@/ui-components/MenuIcon";
import Icon from "@/ui-components/Icon";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/ui-components/primitives/dropdown-menu";
import { Button } from "@/ui-components/primitives/button";
import EditorDialog from "@/ui-components/EditorDialog";

type Props = {
  removable?: boolean;
  params?: any;
  onRemoveWidget?: () => void;
  onConfig?: (cfg: any) => void;
};

export default function BoardWidgetSettings({
  removable,
  params,
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
            onClick={onRemoveWidget}
            disabled={!removable}
          >
            <MenuIcon icon={Trash2} />
            <span>Remove Widget from Home</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-base"
            onClick={() => setIsConfigEditorOpen(true)}
            disabled={!removable}
          >
            <MenuIcon icon={Settings} />
            <span>Configure</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {isConfigEditorOpen && (
        <EditorDialog
          isOpen={true}
          title="Enter widget parameters"
          value={params}
          actions={
            onApplyConfig ? [{ label: "Apply", onAction: onApplyConfig }] : []
          }
          onClose={onCloseConfigEditor}
        />
      )}
    </>
  );
}
