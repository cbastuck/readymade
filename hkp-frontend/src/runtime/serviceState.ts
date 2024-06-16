import { AppInstance, InstanceId } from "@/types";

export function onServiceStartProcess(
  app: AppInstance,
  svc: InstanceId,
  params: any
) {
  app.notify(svc, { __internal: { state: "call-process", data: params } });
}

export function onServiceEndProcess(
  app: AppInstance,
  svc: InstanceId,
  result: any
) {
  app.notify(svc, {
    __internal: { state: "call-process-finished", data: result },
  });
}
