import {
  AppImpl,
  ProcessContext,
  RuntimeApi,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceAction,
  User,
} from "@/types";

import api from "./RealtimeRuntimeApi";
import { createRealtimeRuntimeApp } from "./RealtimeRuntimeApp";

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
      this.runtimeOutput.onmessage = (event) => {
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
        } else {
          console.warn(
            "RealtimeRuntimeScope.runtimeOutput.onmessage unknown message type",
            msg
          );
        }
      };
      this.runtimeOutput.onerror = (event) => {
        console.error("RealtimeRuntimeScope.runtimeOutput.onerror", event);
      };
      this.runtimeOutput.onopen = (event) => {
        console.log("RealtimeRuntimeScope.runtimeOutput.onopen", event);
      };
    }
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
}
