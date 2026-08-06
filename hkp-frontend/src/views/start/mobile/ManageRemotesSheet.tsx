import BottomSheet from "../../playground/mobile/BottomSheet";
import ManageRuntimesContent from "../../../ui-components/toolbar/ManageRuntimesContent";
import ManageCoordinatorsContent from "../../cloud/ManageCoordinatorsContent";
import type { CoordinatorsController, RemotesController } from "../StartPage";

type Props = {
  open: boolean;
  onClose: () => void;
  remotes?: RemotesController;
  coordinators?: CoordinatorsController;
};

/**
 * Mobile surface for connection management: hosts the shared
 * ManageRuntimesContent (existing remotes, LAN discovery, manual add) and
 * ManageCoordinatorsContent in a bottom sheet — the same sources the desktop
 * dialogs wrap. Both roles live in one sheet because both answer the same
 * question on a phone: which servers does this app know about.
 */
export default function ManageRemotesSheet({
  open,
  onClose,
  remotes,
  coordinators,
}: Props) {
  return (
    // z-40: the runtime rows open Radix dropdowns / the color-picker popover,
    // which portal to <body> at z-50 and must stack above the sheet.
    <BottomSheet
      open={open}
      onClose={onClose}
      title={coordinators ? "Connections" : "Remotes"}
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
        {remotes && (
          <ManageRuntimesContent
            remoteRuntimes={remotes.runtimes}
            onAddRuntimeEngine={remotes.onAdd}
            onRemoveRuntimeEngine={remotes.onRemove}
            onUpdateRuntimeEngine={remotes.onUpdate}
            inlineNewRuntimePanel
          />
        )}
        {coordinators && (
          <ManageCoordinatorsContent
            coordinators={coordinators.coordinators}
            onAdd={coordinators.onAdd}
            onRemove={coordinators.onRemove}
            inlineNewCoordinatorPanel
          />
        )}
      </div>
    </BottomSheet>
  );
}
