import BottomSheet from "../../playground/mobile/BottomSheet";
import ManageConnectionsContent from "../../../ui-components/connections/ManageConnectionsContent";
import type { CoordinatorsController, RemotesController } from "../StartPage";

type Props = {
  open: boolean;
  onClose: () => void;
  remotes?: RemotesController;
  coordinators?: CoordinatorsController;
};

/**
 * Mobile surface for connection management: hosts the shared
 * ManageConnectionsContent (existing remotes and coordinators, LAN discovery,
 * manual add) in a bottom sheet — the same content the desktop settings
 * dialog wraps. Both roles live in one sheet because both answer the same
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
        <ManageConnectionsContent
          remotes={remotes}
          coordinators={coordinators}
        />
      </div>
    </BottomSheet>
  );
}
