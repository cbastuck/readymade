import {
  AppImpl,
  InstanceId,
  ServiceAction,
  ServiceClass,
  ServiceImpl,
} from "../../types";
import RemoteRuntimeScope from "./RemoteRuntimeScope";

export function createRemoteRuntimeApp(scope: RemoteRuntimeScope): AppImpl {
  return {
    getAuthenticatedUser: () => scope.authenticatedUser,
    notify: (svc: ServiceImpl, notification: any): void => {},
    next: (svc: InstanceId | null, result: any): void => {},
    getServiceById: (uuid: string): ServiceImpl | null => {
      return null;
    },
    sendAction: (action: ServiceAction): void => {},
    storeServiceData: (
      serviceUuid: string,
      key: string,
      value: string
    ): void => {},
    restoreServiceData: (serviceUuid: string, key: string): void => {},
    removeServiceData: (serviceUuid: string, key: string): void => {},
    createSubService: (
      parent: ServiceImpl,
      service: ServiceClass,
      instanceId?: string
    ): void => {},
    createSubServiceUI: (svc: ServiceImpl): void => {},
    listAvailableServices: () => [],
  };
}
