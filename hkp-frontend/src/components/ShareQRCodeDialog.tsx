import CustomDialog from "hkp-frontend/src/ui-components/CustomDialog";

import QR from "./QR";
import Copyable from "./Copyable";

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
  const onOpenChange = (newIsOpen: boolean) => {
    if (newIsOpen === false) {
      onClose();
    }
  };

  return (
    <CustomDialog isOpen={isOpen} onOpenChange={onOpenChange} title={title}>
      <div className="h-full w-full flex flex-col items-center">
        {url ? (
          <>
            <QR url={url || ""} />
            <Copyable label="URL" value={url} />
          </>
        ) : (
          <div>Empty URL</div>
        )}

        {children || null}
      </div>
    </CustomDialog>
  );
}
