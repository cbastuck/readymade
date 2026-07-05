import BottomSheet from "../../playground/mobile/BottomSheet";
import ManageRuntimesContent from "../../../ui-components/toolbar/ManageRuntimesContent";
import type { RemotesController } from "../StartPage";

type Props = {
  open: boolean;
  onClose: () => void;
  remotes: RemotesController;
};

/**
 * Mobile surface for remote-runtime management: hosts the shared
 * ManageRuntimesContent (existing remotes, LAN discovery, manual add)
 * in a bottom sheet — the same one source the desktop dialog wraps.
 */
export default function ManageRemotesSheet({ open, onClose, remotes }: Props) {
  return (
    // z-40: the runtime rows open Radix dropdowns / the color-picker popover,
    // which portal to <body> at z-50 and must stack above the sheet.
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Remotes"
      height="80%"
      zIndex={40}
    >
      {/* Inputs must render at >= 16px or iOS Safari zooms into them. */}
      <style>{`
        .hkp-remotes-sheet input,
        .hkp-remotes-sheet select {
          font-size: 16px;
        }
      `}</style>
      <div
        className="hkp-remotes-sheet"
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <ManageRuntimesContent
          remoteRuntimes={remotes.runtimes}
          onAddRuntimeEngine={remotes.onAdd}
          onRemoveRuntimeEngine={remotes.onRemove}
          onUpdateRuntimeEngine={remotes.onUpdate}
          inlineNewRuntimePanel
        />
      </div>
    </BottomSheet>
  );
}
