import { loadBundle } from './Bundles';
import defaultRegistry from './registry/Default';

export default class BrowserRegistry {
  static async create(bundles, user) {
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

  loadUserBundles = async user => {
    if (user && user.features && user.features.registry) {
      const userBundles = JSON.parse(user.features.registry);
      await this.loadBundles(userBundles); 
    }
  }

  async loadBundles(bundles) {
    if (bundles) {
      for (const bundleId of bundles) {
        const bdl = await loadBundle(bundleId);
        this.__appendBundleServices(bdl);
      }
    }
    return this.availableServices;
  }

  __appendBundleServices = arr => {
    arr.forEach(x => {
      const exists = this.availableServices && 
                      this.availableServices.find( 
                      s => x && (x.serviceId === s.serviceId));
      if (!exists) {
        if (this.availableServices) {
          this.availableServices.push(x);
        } else {
          this.availableServices = [x];
        }
      }
    });
  }
}