import { ReactNode, createContext, useContext, useState } from "react";

import { BoardContextState } from "hkp-frontend/src/BoardContext";
import ShareQRCodeDialog from "hkp-frontend/src/components/ShareQRCodeDialog";
import { createPartnerBoardLink } from "hkp-frontend/src/core/partnerBoard";

/**
 * What a facade can ask of the board itself, as opposed to of a service on it.
 *
 * A widget action normally names a service and says configure or process. These
 * have no service to name: the subject is the board, and the effect is on the
 * window the facade is being shown in. A host that offers none of this mounts
 * no provider, and the actions are inert rather than absent — a board is shown
 * by more than one host, and the ones that cannot do this should still render.
 */
export type FacadeBoardActions = {
  /** Shows the board that connects back to this one, as a QR code. */
  showPartnerBoardQr: () => void;
};

export const FacadeBoardActionsContext = createContext<FacadeBoardActions>({
  showPartnerBoardQr: () => {},
});

export const useFacadeBoardActions = () =>
  useContext(FacadeBoardActionsContext);

/**
 * Provides the board actions and owns the windows they open, so a host adds
 * them by wrapping its panels rather than by repeating the dialogs.
 */
export function FacadeBoardActionsProvider({
  boardContext,
  children,
}: {
  boardContext: BoardContextState;
  children: ReactNode;
}) {
  const [partnerUrl, setPartnerUrl] = useState<string | null>(null);

  const showPartnerBoardQr = () => {
    createPartnerBoardLink(boardContext).then(setPartnerUrl);
  };

  return (
    <FacadeBoardActionsContext.Provider value={{ showPartnerBoardQr }}>
      {children}
      <ShareQRCodeDialog
        title="Partner board"
        isOpen={partnerUrl !== null}
        url={partnerUrl}
        onClose={() => setPartnerUrl(null)}
      />
    </FacadeBoardActionsContext.Provider>
  );
}
