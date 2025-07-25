import { AppInstance, InstanceId } from "hkp-frontend/src/types";

export function onServiceProcess(
  app: AppInstance,
  svc: InstanceId,
  params: any
) {
  app.notify(svc, { __internal: { state: "call-process", data: params } });
}

export function onServiceResult(
  app: AppInstance,
  svc: InstanceId,
  result: any
) {
  app.notify(svc, {
    __internal: { state: "call-process-finished", data: result },
  });
}
