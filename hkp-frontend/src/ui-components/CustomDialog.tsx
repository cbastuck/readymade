import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import { ReactNode } from "react";

type Props = {
  className?: string;
  title?: string;
  children: ReactNode;
  isOpen: boolean;
  onOpenChange: (newIsOpen: boolean) => void;
};
export default function CustomDialog({
  className,
  title,
  children,
  isOpen,
  onOpenChange,
}: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={`sm:max-w-[80%] h-[80%] flex flex-col ${className}`}
      >
        <DialogTitle>{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
