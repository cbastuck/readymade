import { ReactElement } from "react";
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
    notify: (_svc: ServiceImpl, _notification: any): void => {},
    next: (_svc: InstanceId | null, _result: any): void => {},
    getServiceById: (_uuid: string): ServiceImpl | null => {
      return null;
    },
    sendAction: (_action: ServiceAction): void => {},
    storeServiceData: (
      _serviceUuid: string,
      _key: string,
      _value: string
    ): void => {},
    restoreServiceData: (_serviceUuid: string, _key: string): void => {},
    removeServiceData: (_serviceUuid: string, _key: string): void => {},
    createSubService: (
      _parent: ServiceImpl,
      _service: ServiceClass,
      _instanceId?: string
    ): void => {},
    createSubServiceUI: (_svc: ServiceImpl): ReactElement | null => {
      return null;
    },
    listAvailableServices: () => [],
  };
}
