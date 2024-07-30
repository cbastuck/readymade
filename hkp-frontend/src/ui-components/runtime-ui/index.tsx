import { CSSProperties, ReactElement, ReactNode } from "react";

import {
  OnResult,
  ProcessRuntimeByName,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceAction,
  ServiceClass,
  ServiceDescriptor,
  ServiceRegistry,
  User,
} from "@/types";
import RuntimeHeader from "./RuntimeHeader";
import BrowserRuntime from "@/runtime/browser/BrowserRuntime";
import RemoteRuntime from "@/runtime/remote/RemoteRuntime";
import BrowserRuntimeScope from "@/runtime/browser/BrowserRuntimeScope";
import { useTheme } from "@/ui-components/ThemeContext";
import { HKP_DND_RUNTIME_TYPE } from "@/components/DropTypes";
import DragSource from "@/components/DragSource";

type Props = {
  user: User | null;
  boardName: string | null;
  runtime: RuntimeDescriptor;
  registry: ServiceRegistry;
  scope: RuntimeScope;
  services: Array<ServiceDescriptor>;
  frameless?: boolean;
  headless?: boolean;
  wrapServices?: boolean;
  isExpanded?: boolean;
  style?: CSSProperties;
  outputs?: ReactElement;
  inputs?: ReactElement;
  children?: ReactNode | ReactNode[];

  onExpand: (isExpanded: boolean) => void;
  onWrapServices: (isWrapped: boolean) => void;
  onAddService: (svc: ServiceClass) => void;
  onServiceAction: (command: ServiceAction) => void;
  onArrangeService: (serviceUuid: string, position: number) => void;
  onResult: OnResult;
  processRuntimeByName: ProcessRuntimeByName;
};

export default function RuntimeUI({
  user,
  boardName,
  runtime,
  services,
  scope,
  frameless,
  headless,
  wrapServices,
  style: passedStyled,
  children,
  registry,
  isExpanded = true,
  outputs,
  inputs,

  onExpand,
  onWrapServices,
  onAddService,
  onServiceAction,
  onArrangeService,
  onResult,
  processRuntimeByName,
}: Props) {
  const theme = useTheme();
  const style: CSSProperties = {
    ...passedStyled,
    border:
      !frameless && !headless ? `solid 1px ${theme.borderColor}` : undefined,
    borderRadius: theme.borderRadius,
    backgroundColor: theme.runtimeBackgroundColor,
    color: theme.textColor,
    backgroundImage: theme.runtimeBackgroundImage,
  };

  if (scope) {
    scope.authenticatedUser = user;
  }

  const expanded = headless ? false : isExpanded;
  const horizontalLayout = "flex";
  // TODO: not good on mobile - double check
  const horizontalLayoutWrapped =
    "flex sm:flex-wrap flex-col sm:flex-row items-start"; // use flex-col and items-center on mobile
  const layout = wrapServices ? horizontalLayoutWrapped : horizontalLayout;
  return (
    <div style={style} className="select-none">
      <DragSource
        className="bg-[#FFFFFF50]"
        value={runtime}
        type={HKP_DND_RUNTIME_TYPE}
      >
        <RuntimeHeader
          isExpanded={isExpanded}
          wrapServices={wrapServices}
          runtime={runtime}
          registry={registry}
          onAddService={onAddService}
          onExpand={onExpand}
          onWrapServices={onWrapServices}
        />
      </DragSource>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
        }}
      >
        {runtime.type === "browser" ? (
          <>
            {inputs && expanded ? <>{inputs}</> : false}
            <div
              className={layout}
              style={{
                width: "100%",
                overflow: wrapServices ? "hidden" : "auto",
              }}
            >
              <BrowserRuntime
                key={`browser-runtime-${runtime.id}`}
                collapsed={!expanded}
                user={user}
                boardName={boardName || ""}
                scope={scope as BrowserRuntimeScope}
                runtime={runtime}
                services={services}
                onArrangeService={onArrangeService}
                onServiceAction={onServiceAction}
                onResult={onResult}
                processRuntimeByName={processRuntimeByName}
              />
            </div>
            {outputs && expanded ? (
              <div className="ml-auto pl-4">{outputs}</div>
            ) : null}
          </>
        ) : (
          <>
            <RemoteRuntime
              key={`remote-runtime-${runtime.id}`}
              collapsed={!expanded}
              scope={scope}
              user={user}
              boardName={boardName || ""}
              runtime={runtime}
              services={services}
              onArrangeService={onArrangeService}
              onServiceAction={onServiceAction}
              onResult={onResult}
            />
          </>
        )}
        {children}
      </div>
      {!isExpanded && <div className="min-h-1" />}
    </div>
  );
}
