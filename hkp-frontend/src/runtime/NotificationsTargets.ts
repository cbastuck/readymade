import { InstanceId, ServiceInstance } from "hkp-frontend/src/types";

type Callback = (notification: any) => void;

export default class NotificationTargets {
  callbacks: { [id: string]: Array<Callback> };

  constructor() {
    this.callbacks = {};
  }

  register(svc: ServiceInstance, callback: Callback) {
    const id = svc.uuid;
    const callbacks = this.callbacks[id] || [];
    this.callbacks[id] = callbacks.concat(callback);
  }

  unregister(svc: ServiceInstance, callback: Callback) {
    const id = svc.uuid;
    const callbacks = this.callbacks[id] || [];
    this.callbacks[id] = callbacks.filter((cb) => cb !== callback);
  }

  notify(service: InstanceId, notification: any) {
    const callbacks = this.callbacks[service.uuid] || [];
    for (const cb of callbacks) {
      cb(notification);
    }
  }

  hasCallbacks(service: InstanceId): boolean {
    const id = service.uuid;
    return !!this.callbacks[id]?.length;
  }
}
