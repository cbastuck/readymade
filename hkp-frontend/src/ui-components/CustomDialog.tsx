import {
  Dialog,
  DialogContent,
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
        <h1>{title}</h1>
        {children}
      </DialogContent>
    </Dialog>
  );
}
