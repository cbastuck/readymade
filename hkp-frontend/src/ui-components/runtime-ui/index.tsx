import { CSSProperties, ReactNode } from "react";

import { RuntimeDescriptor, ServiceClass, ServiceRegistry } from "@/types";
import RuntimeHeader from "./RuntimeHeader";

type Props = {
  runtime: RuntimeDescriptor;
  frameless?: boolean;
  headless?: boolean;
  wrapServices?: boolean;
  isExpanded?: boolean;
  style?: CSSProperties;
  children?: ReactNode | ReactNode[];
  registry: ServiceRegistry;
  onExpand: (isExpanded: boolean) => void;
  onWrapServices: (isWrapped: boolean) => void;
  onAddService: (svc: ServiceClass) => void;
};

export default function RuntimeUI({
  runtime,
  frameless,
  headless,
  wrapServices,
  style: passedStyled,
  children,
  registry,
  isExpanded = true,
  onExpand,
  onWrapServices,
  onAddService,
}: Props) {
  const style: CSSProperties = {
    ...passedStyled,
    border: !frameless && !headless ? "solid 1px lightgray" : undefined,
    borderRadius: 3,
    backgroundColor: !frameless ? "#EEEEEE10" : undefined,
  };

  return (
    <div style={style}>
      <RuntimeHeader
        isExpanded={isExpanded}
        wrapServices={wrapServices}
        runtime={runtime}
        registry={registry}
        onAddService={onAddService}
        onExpand={onExpand}
        onWrapServices={onWrapServices}
      />
      {children}
      {!isExpanded && <div className="min-h-1" />}
    </div>
  );
}
