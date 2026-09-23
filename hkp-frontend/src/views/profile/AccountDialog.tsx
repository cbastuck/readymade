import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";

import AccountPage from "./AccountPage";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * The account over whatever is on screen, rather than in place of it.
 *
 * Looking at an account is not leaving what you were doing, and a board is
 * live state: its runtimes are running and its unsaved edits exist nowhere
 * else, so a view that replaces it destroys work nobody agreed to lose. An
 * overlay keeps the board mounted and running underneath, and closing puts you
 * back exactly where you were — no route, nothing to restore.
 *
 * The page at `/profile` frames the same content for the other case: arriving
 * at an account directly, with nothing to overlay.
 */
export default function AccountDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl w-[92vw]"
        // Only the close button and Esc dismiss this. The account holds a form
        // with unsaved edits in it, and a stray click on the board behind is
        // not someone saying they are done with it.
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Account</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <AccountPage />
        </div>
      </DialogContent>
    </Dialog>
  );
}
