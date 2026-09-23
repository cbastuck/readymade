import { InstanceId, ServiceInstance } from "hkp-frontend/src/types";

type Callback = (notification: any) => void;

/**
 * What a service's notifications are filed under: its address where it has one
 * — a service inside a scope — and its uuid otherwise.
 */
function key(svc: InstanceId): string {
  return svc.address ?? svc.uuid;
}

export default class NotificationTargets {
  callbacks: { [id: string]: Array<Callback> };

  constructor() {
    this.callbacks = {};
  }

  register(svc: ServiceInstance, callback: Callback) {
    const id = key(svc);
    const callbacks = this.callbacks[id] || [];
    this.callbacks[id] = callbacks.concat(callback);
  }

  unregister(svc: ServiceInstance, callback: Callback) {
    const id = key(svc);
    const callbacks = this.callbacks[id] || [];
    this.callbacks[id] = callbacks.filter((cb) => cb !== callback);
  }

  notify(service: InstanceId, notification: any) {
    const callbacks = this.callbacks[key(service)] || [];
    for (const cb of callbacks) {
      cb(notification);
    }
  }

  hasCallbacks(service: InstanceId): boolean {
    const id = key(service);
    return !!this.callbacks[id]?.length;
  }
}
