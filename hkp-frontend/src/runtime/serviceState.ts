import { AppInstance, InstanceId } from "hkp-frontend/src/types";
import { reportedValue } from "./callReport";

/**
 * Each call to a service is bracketed by a pair of notifications, and both
 * carry the call's id: calls of one service may overlap — a clock starting the
 * next bar before the last has quite finished — and what listens has to tell
 * which call an end belongs to. One that began listening in the middle of a
 * call hears an end it never heard begin, and can leave it alone.
 */
let lastCall = 0;

/** Says a call begins; returns the id its end is to be reported under. */
export function onServiceProcess(
  app: AppInstance,
  svc: InstanceId,
  params: any
): number {
  const call = ++lastCall;
  // What a report carries is bounded as in every runtime: the inspector keeps
  // a history of these, and would otherwise hold each large value it was shown.
  app.notify(svc, {
    __internal: { state: "call-process", data: reportedValue(params), call },
  });
  return call;
}

export function onServiceResult(
  app: AppInstance,
  svc: InstanceId,
  result: any,
  call?: number
) {
  app.notify(svc, {
    __internal: {
      state: "call-process-finished",
      data: reportedValue(result),
      ...(call !== undefined ? { call } : {}),
    },
  });
}
