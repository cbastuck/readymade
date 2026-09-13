import { useEffect, useState } from "react";

import CustomDialog from "hkp-frontend/src/ui-components/CustomDialog";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";

import QR from "./QR";

type Props = {
  title?: string;
  isOpen: boolean;
  url: string | null;
  children?: any;
  onClose: () => void;
};

export default function ShareQRCodeDialog({
  title,
  url,
  isOpen,
  children,
  onClose,
}: Props) {
  // A long payload produces a dense code whose canvas is larger than the
  // dialog. Fitting it keeps everything visible; actual size keeps the modules
  // crisp enough to scan and lets the container scroll instead.
  const [fitToDialog, setFitToDialog] = useState(true);

  useEffect(() => {
    setFitToDialog(true);
  }, [url, isOpen]);

  const onOpenChange = (newIsOpen: boolean) => {
    if (newIsOpen === false) {
      onClose();
    }
  };

  return (
    <CustomDialog isOpen={isOpen} onOpenChange={onOpenChange} title={title}>
      <div className="min-h-0 flex-1 w-full flex flex-col items-center gap-2">
        {url ? (
          <>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 block w-full px-10 overflow-hidden text-ellipsis whitespace-nowrap"
            >
              {url}
            </a>

            <div className="min-h-0 flex-1 w-full overflow-auto flex items-start justify-center">
              <QR
                url={url}
                className={
                  fitToDialog
                    ? "shrink-0 w-auto h-auto max-w-full max-h-full"
                    : "shrink-0 max-w-none"
                }
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setFitToDialog((fit) => !fit)}
            >
              {fitToDialog ? "Actual size" : "Fit to dialog"}
            </Button>
          </>
        ) : (
          <div>Empty URL</div>
        )}

        {children || null}
      </div>
    </CustomDialog>
  );
}
