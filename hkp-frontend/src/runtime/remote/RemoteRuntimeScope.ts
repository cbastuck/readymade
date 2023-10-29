import { AppImpl, RuntimeDescriptor, RuntimeScope } from "../../types";
import { createRemoteRuntimeApp } from "./RemoteRuntimeApp";

export default class RemoteRuntimeScope implements RuntimeScope {
  app: AppImpl;
  descriptor: RuntimeDescriptor; // TODO: better keep the whole runtime descriptor - change API

  constructor(runtime: RuntimeDescriptor) {
    this.app = createRemoteRuntimeApp(this);
    this.descriptor = runtime;
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
