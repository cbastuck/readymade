import CustomDialog from "hkp-frontend/src/ui-components/CustomDialog";

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
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block w-full px-10 overflow-hidden text-ellipsis whitespace-nowrap"
            >
              {url}
            </a>

            <QR url={url || ""} />
          </>
        ) : (
          <div>Empty URL</div>
        )}

        {children || null}
      </div>
    </CustomDialog>
  );
}
