import { ServiceDescriptor } from "@/types";

type Callback = (svc: ServiceDescriptor, notification: any) => void;

export default class NotificationTargets {
  callbacks: { [id: string]: Callback };

  constructor() {
    this.callbacks = {};
  }

  register(id: string, callback: Callback) {
    this.callbacks[id] = callback;
  }

  unregister(id: string) {
    delete this.callbacks[id];
  }

  notify(service: ServiceDescriptor, notification: any) {
    for (const id in this.callbacks) {
      const cb = this.callbacks[id];
      cb(service, notification);
    }
  }

  get(id: string): Callback | undefined {
    return this.callbacks[id];
  }
}
