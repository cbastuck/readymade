import { ReactElement } from "react";

import {
  Alert as AlertCN,
  AlertDescription,
  AlertTitle,
} from "hkp-frontend/src/ui-components/primitives/alert";

type Props = {
  className?: string;
  title?: string;
  icon?: ReactElement;
  children: any;
};
export default function Alert({ className, title, icon, children }: Props) {
  return (
    <AlertCN className={`${className} w-full mx-auto`}>
      <AlertTitle className="flex gap-2">
        {icon} {title}
      </AlertTitle>
      <AlertDescription className="text-base text-left">
        {children}
      </AlertDescription>
    </AlertCN>
  );
}
