import { BoardContextState, useBoardContext } from "../../../BoardContext";
import { useEditReportingService } from "../../../core/editedServices";
import { blockUseContaining } from "../../../runtime/board/blocks";
import BrowserRuntimeScope from "../../../runtime/browser/BrowserRuntimeScope";
import { findServiceUI as findBrowserServiceUI } from "../../../runtime/browser/UIRegistry";
import { makeServiceInstance as makeGraphQLInstance } from "../../../runtime/graphql/RuntimeGraphQL";
import RuntimeGraphQLServiceUI from "../../../runtime/graphql/RuntimeGraphQLServiceUI";
import { findServiceUI as findGraphQLServiceUI } from "../../../runtime/graphql/UIRegistry";
import { makeServiceInstance as makeRestInstance } from "../../../runtime/rest/RuntimeRest";
import RuntimeRestServiceUI from "../../../runtime/rest/RuntimeRestServiceUI";
import { findServiceUI as findRestServiceUI } from "../../../runtime/rest/UIRegistry";
import BlockUseFrame from "../../../runtime/ui/BlockUse";
import {
  RuntimeDescriptor,
  ServiceAction,
  ServiceDescriptor,
  ServiceInstance,
  isRuntimeBrowserClassType,
  isRuntimeGraphQLClassType,
  isRuntimeRestClassType,
} from "../../../types";
import { M, SERVICE_UI_ZOOM } from "./tokens";

/**
 * The panel of a service a runtime holds itself, and the instance it drives:
 * the live one a browser runtime holds, or one that reaches a remote runtime's
 * service over its scope. What a service's sheet shows at its top level, and
 * what its card unfolds.
 */
export function rootServiceUI(
  boardContext: BoardContextState,
  runtime: RuntimeDescriptor,
  service: ServiceDescriptor,
): { instance: ServiceInstance | null; UI: any; reason?: string } {
  const scope = boardContext.scopes[runtime.id];
  const boardName = boardContext.boardName ?? "";
  if (isRuntimeBrowserClassType(runtime.type)) {
    const browserScope = scope as BrowserRuntimeScope | undefined;
    const instance =
      browserScope?.findServiceInstance(service.uuid)?.[0] ?? null;
    const UI = instance
      ? (findBrowserServiceUI(service.serviceId) ??
        browserScope?.registry.findServiceModule(service.serviceId)
          ?.createUI ??
        null)
      : null;
    return {
      instance,
      UI,
      reason: scope ? "Service UI not available" : "Runtime not yet initialized",
    };
  }
  if (isRuntimeRestClassType(runtime.type)) {
    if (!scope) {
      return { instance: null, UI: null, reason: "Runtime not yet initialized" };
    }
    const instance = makeRestInstance(scope, service, boardName);
    const UI =
      findRestServiceUI({
        serviceId: service.serviceId,
        version: service.version,
        capabilities: service.capabilities,
      }) ?? RuntimeRestServiceUI;
    return { instance, UI };
  }
  if (isRuntimeGraphQLClassType(runtime.type)) {
    if (!scope) {
      return { instance: null, UI: null, reason: "Runtime not yet initialized" };
    }
    const instance = makeGraphQLInstance(scope, service, boardName);
    const UI = findGraphQLServiceUI(service.serviceId) ?? RuntimeGraphQLServiceUI;
    return { instance, UI };
  }
  return {
    instance: null,
    UI: null,
    reason: "Service UI not available for this runtime type",
  };
}

/**
 * A runtime's own service's panel, drawn in a service card that is expanded
 * further: watched in the list beside the others rather than in a sheet.
 * Locked where a block's use keeps it, as in the sheet.
 */
export function ServiceUIPanel({
  runtime,
  service,
}: {
  runtime: RuntimeDescriptor;
  service: ServiceDescriptor;
}) {
  const boardContext = useBoardContext();
  const editable = useEditReportingService();
  if (!boardContext) {
    return null;
  }
  const { instance, UI, reason } = rootServiceUI(boardContext, runtime, service);
  if (!UI || !instance) {
    return (
      <div style={{ padding: 16, fontSize: 13, color: M.textMuted, textAlign: "center" }}>
        {reason ?? "Service UI not available"}
      </div>
    );
  }

  const onServiceAction = (cmd: ServiceAction) => {
    if (cmd.action === "remove") {
      boardContext.removeService({ uuid: cmd.service.uuid }, runtime);
    } else if (cmd.action === "rename" && cmd.payload?.value) {
      boardContext.setServiceName(runtime.id, cmd.service.uuid, cmd.payload.value);
    }
  };
  const blocks = boardContext.linkage?.blocks;

  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ zoom: SERVICE_UI_ZOOM, width: `calc(100% / ${SERVICE_UI_ZOOM})` }}>
        <BlockUseFrame
          address={service.uuid}
          runtimeId={runtime.id}
          locked={!!blockUseContaining(blocks, service.uuid, runtime.id)}
          onRemove={() => onServiceAction({ action: "remove", service: instance })}
        >
          <UI
            service={editable(instance)}
            showBypassOnlyIfExplicit={!isRuntimeBrowserClassType(runtime.type)}
            draggable={false}
            onServiceAction={onServiceAction}
          />
        </BlockUseFrame>
      </div>
    </div>
  );
}
