import { Bundles, ServiceClass, ServiceModule, User } from "../../types";
import { loadBundle } from "../Bundles";
import { defaultRegistry } from "./registry/Default";

export const allowedServices = [
  "hookup.to/service/timer",
  "hookup.to/service/monitor",
  "hookup.to/service/canvas",
  "hookup.to/service/map",
  "hookup.to/service/filter",
  "hookup.to/shared/batcher",
  "hookup.to/service/switch",
  "hookup.to/service/camera",
  "hookup.to/service/injector",
  "hookup.to/service/trigger-pad",
  "hookup.to/service/sound",
  "hookup.to/service/audio-output",
  "hookup.to/service/audio-input",
  "hookup.to/service/audio-recorder",
  "hookup.to/service/gif-encoder",
  "hookup.to/service/input",
  "hookup.to/service/output",
  "hookup.to/service/thrower",
  "hookup.to/service/receiver",
  "hookup.to/service/downloader",
  "hookup.to/service/mp3encoder",
  "hookup.to/service/reduce",
  "hookup.to/service/buffer",
  "hookup.to/service/group-by",
  "hookup.to/service/match-filter",
  "hookup.to/service/chart",
  "hookup.to/service/spotify",
  "hookup.to/service/github-source",
  "hookup.to/service/github-sink",
  "hookup.to/service/cache",
  "hookup.to/service/key-handler",
  "hookup.to/service/reactor",
  "hookup.to/service/html",
  "hookup.to/service/array-transform",
  "hookup.to/service/xy-pad",
  "hookup.to/service/encrypt",
  "hookup.to/service/decrypt",
  "hookup.to/service/hash",
  "hookup.to/service/sign",
  "hookup.to/service/linear-regression",
  "hookup.to/service/xlsl",
  "hookup.to/service/select",
  "hookup.to/service/hacker/considered",
  "hookup.to/service/hacker/dangerous",
  "hookup.to/service/fetcher",
  "hookup.to/service/cloud-source",
  "hookup.to/service/cloud-sink",
  "hookup.to/service/board-service",
  "hookup.to/service/stack",
  "hookup.to/service/peer-socket",
  "hookup.to/service/ollama-prompt",
  "hookup.to/service/speech-synth",
  "hookup.to/service/fft",
  "sub-service",
  "hookup.to/service/lz-compress",
  "hookup.to/service/stopper",
  "hookup.to/service/sort",
  "hookup.to/service/limit",
  "hookup.to/service/flat-map",
  "hookup.to/service/smooth",
];

export default class BrowserRegistry {
  availableServices: Array<ServiceModule> = defaultRegistry;

  static async create(
    bundles?: Bundles,
    user?: User,
  ): Promise<BrowserRegistry> {
    const registry = new BrowserRegistry();
    registry.availableServices = defaultRegistry;
    if (bundles && bundles.length) {
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

  findServiceModule(serviceId: string): ServiceModule | undefined {
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

  allowedServices() {
    const allowAllServices = true;
    return this.availableServices.filter(
      (s) => allowAllServices || allowedServices.indexOf(s.serviceId) !== -1,
    );
  }

  allServices() {
    return this.availableServices;
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
