import { Bundles, ServiceClass, ServiceModule, User } from "../types";
import { loadBundle } from "./Bundles";
import { defaultRegistry } from "./registry/Default";

export default class BrowserRegistry {
  availableServices: Array<ServiceModule> = defaultRegistry;

  static async create(bundles: Bundles, user?: User): Promise<BrowserRegistry> {
    const registry = new BrowserRegistry();
    registry.availableServices = defaultRegistry;
    if (bundles) {
      await registry.loadBundles(bundles);
    }
    if (user) {
      await registry.loadUserBundles(user);
    }
    return registry;
  }

  getServiceClasses(): Array<ServiceClass> {
    return this.availableServices.map(({ serviceId, serviceName }) => ({
      serviceId,
      serviceName,
    }));
  }

  find(serviceId: string): ServiceModule | undefined {
    return this.availableServices.find((elem) => elem.serviceId === serviceId);
  }

  loadUserBundles = async (user: User) => {
    if (user && user.features && user.features.registry) {
      const userBundles: Array<string> = JSON.parse(user.features.registry);
      await this.loadBundles(userBundles);
    }
  };

  async loadBundles(bundles: Bundles): Promise<BrowserRegistry> {
    if (bundles) {
      for (const bundleId of bundles) {
        const bdl = await loadBundle(bundleId);
        this.__appendBundleServices(bdl);
      }
    }
    return this;
  }

  __appendBundleServices = (arr: Array<ServiceModule>) => {
    arr.forEach((x) => {
      const exists =
        this.availableServices &&
        this.availableServices.find((s) => x && x.serviceId === s.serviceId);
      if (!exists) {
        if (this.availableServices) {
          this.availableServices.push(x);
        } else {
          this.availableServices = [x];
        }
      }
    });
  };
}
