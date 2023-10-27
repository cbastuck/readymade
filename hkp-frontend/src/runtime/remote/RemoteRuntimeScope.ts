import { AppImpl, RuntimeScope } from "../../types";
import { createRemoteRuntimeApp } from "./RemoteRuntimeApp";

export default class RemoteRuntimeScope implements RuntimeScope {
  app: AppImpl;
  runtimeId: string;

  constructor(runtimeId: string) {
    this.app = createRemoteRuntimeApp(this);
    this.runtimeId = runtimeId;
  }

  getApp = (): AppImpl => {
    return this.app;
  };

  onResult = async (
    instanceId: string | null,
    result: any,
    requestId: string | null
  ): Promise<void> => {
    console.warn("BrowserRuntimeScope.onResult not set");
  };
}
