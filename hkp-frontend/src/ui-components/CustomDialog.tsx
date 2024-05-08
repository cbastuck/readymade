import { Dialog, DialogContent } from "@/ui-components/primitives/dialog";
import { ReactElement } from "react";

type Props = {
  title?: string;
  children: ReactElement;
  isOpen: boolean;
  onOpenChange: (newIsOpen: boolean) => void;
};
export default function CustomDialog({
  title,
  children,
  isOpen,
  onOpenChange,
}: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[80%] h-[80%] flex flex-col">
        <h1>{title}</h1>
        {children}
      </DialogContent>
    </Dialog>
  );
}
