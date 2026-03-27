import {
  AppImpl,
  ProcessContext,
  RuntimeApi,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceAction,
  User,
} from "hkp-frontend/src/types";

import api from "./RealtimeRuntimeApi";
import { createRealtimeRuntimeApp } from "./RealtimeRuntimeApp";
import {
  MessagePurpose,
  deserializeYasMessage,
  serializeYasMessage,
} from "./Message";
import { isData } from "./Data";

export default class RealtimeRuntimeScope implements RuntimeScope {
  descriptor: RuntimeDescriptor;
  app: AppImpl;
  authenticatedUser: User | null = null;
  runtimeOutput: WebSocket | undefined;

  constructor(runtime: RuntimeDescriptor, runtimeOutputUrl: string) {
    this.descriptor = runtime;
    this.app = createRealtimeRuntimeApp(this);
    if (runtimeOutputUrl) {
      this.runtimeOutput = new WebSocket(runtimeOutputUrl);

      this.runtimeOutput.onmessage = async (event) => {
        const isBinary = typeof event.data !== "string";
        if (isBinary) {
          const message = deserializeYasMessage(await event.data.arrayBuffer());
          if (
            message.purpose === MessagePurpose.RESULT ||
            message.purpose === MessagePurpose.RESULT_AWAITING_RESPONSE ||
            message.purpose === MessagePurpose.RESULT_WITH_REQUEST_ID
          ) {
            let context: ProcessContext | null = null;
            if (
              message.purpose === MessagePurpose.RESULT_AWAITING_RESPONSE ||
              message.purpose === MessagePurpose.RESULT_WITH_REQUEST_ID
            ) {
              console.log(
                "RealtimeRuntimeScope.onmessage with context or awaiting!!",
                message
              );
              context = {
                onResolve:
                  message.purpose === MessagePurpose.RESULT_AWAITING_RESPONSE
                    ? (data: any) => {
                        console.log("RealtimeRuntimeScope.onResolve", data);
                        const context = { requestId: message.sender };
                        this.sendMessageViaWebsocket(
                          data,
                          context,
                          "resolveResult"
                        );
                      }
                    : undefined, // only resolve the runtime that is actually awaiting the result
                requestId: message.sender,
              };
            }
            this.onResult(null, message.data, context);
          } else if (message.purpose === MessagePurpose.NOTIFICATION) {
            this.app.notify({ uuid: message.sender }, message.data);
          } else {
            console.log(
              "RealtimeRuntimeScope.runtimeOutput.onmessage unknown message purpose",
              message
            );
          }
        } else {
          // old JSON format
          const msg = JSON.parse(event.data);
          if (msg.type === "notification") {
            const { instanceId, value } = msg;

            if (value) {
              let data;
              try {
                data = JSON.parse(value);
              } catch (_err) {
                data = value;
              }
              this.app.notify({ uuid: instanceId }, data);
            }
          } else if (msg.type === "result") {
            this.onResult(null, msg.data, null);
          } else {
            console.warn(
              "RealtimeRuntimeScope.runtimeOutput.onmessage unknown message type",
              msg
            );
          }
        }
      };
      this.runtimeOutput.onerror = (event) => {
        console.error("RealtimeRuntimeScope.runtimeOutput.onerror", event);
      };
      this.runtimeOutput.onopen = (event) => {
        console.log("RealtimeRuntimeScope.runtimeOutput.onopen", event);
        // the first message is the protocol
        const protocol = JSON.stringify({ type: "readwrite", id: runtime.id });
        this.runtimeOutput?.send(protocol);
      };
    }
  }

  sendMessageViaWebsocket(
    params: any,
    context: ProcessContext | null,
    type: "processRuntime" | "resolveResult"
  ): boolean {
    if (!this.runtimeOutput) {
      return false;
    }
    if (isData(params)) {
      // TODO: add support to resolve results with binary Data
      const blob = serializeYasMessage(params, context?.requestId || "");
      this.runtimeOutput.send(blob);
    } else {
      this.runtimeOutput.send(
        JSON.stringify({
          type,
          params,
          context,
        })
      );
    }
    return true;
  }

  getApi(): RuntimeApi {
    return api;
  }

  getApp = (): AppImpl => {
    return this.app;
  };

  onResult = async (
    _instanceId: string | null,
    _result: any,
    _context?: ProcessContext | null
  ): Promise<void> => {
    console.warn("RealtimeRuntimeScope.onResult not set");
  };

  onAction = (_action: ServiceAction): boolean => {
    console.warn("RealtimeRuntimeScope.onAction not implemented");
    return false;
  };

  onConfig = (_instanceId: string, _config: object) => {
    console.warn("RealtimeRuntimeScope.onConfig not set");
  };

  close = async (): Promise<void> => {
    if (this.runtimeOutput) {
      this.runtimeOutput.close();
      this.runtimeOutput = undefined;
    }
  };
}
