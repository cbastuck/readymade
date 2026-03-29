import { beforeAll, describe, expect, it, vi } from "vitest";

type ServiceDescriptor = {
  serviceId: string;
  serviceName: string;
  create: (app: any, board: string, descriptor: any, id: string) => any;
  createUI?: unknown;
};

const moduleLoaders = import.meta.glob("../*.{ts,tsx}");

const SERVICE_DESCRIPTOR_FILES = new Set([
  "Aggregator.ts",
  "Analyzer.tsx",
  "ArrayTransform.tsx",
  "AudioEditor.ts",
  "BoardService.tsx",
  "Buffer.tsx",
  "Camera.ts",
  "Canvas.ts",
  "ChunkedFileProvider.tsx",
  "CloudSink.tsx",
  "CloudSource.tsx",
  "ConsideredHacker.tsx",
  "DangerousHacker.tsx",
  "Delay.tsx",
  "Dispatcher.tsx",
  "Downloader.tsx",
  "Fetcher.tsx",
  "FFT.tsx",
  "FileSource.tsx",
  "Filter.tsx",
  "GithubSink.tsx",
  "GithubSource.tsx",
  "GroupBy.ts",
  "Html.tsx",
  "Injector.ts",
  "Input.ts",
  "KeyHandler.ts",
  "LocalStorage.ts",
  "Looper.tsx",
  "Map.ts",
  "MediaPlayer.tsx",
  "Monitor.tsx",
  "Moog.tsx",
  "OllamaHackerComposite.ts",
  "OllamaPrompt.ts",
  "OpenAIPrompt.ts",
  "Output.tsx",
  "PeerSocket.tsx",
  "Reactor.tsx",
  "Receiver.tsx",
  "RemoteWindow.tsx",
  "Sampling.tsx",
  "Sequencer.tsx",
  "SpeechSynth.ts",
  "Spotify.tsx",
  "Stack.tsx",
  "Switch.tsx",
  "Thrower.tsx",
  "Timeline.tsx",
  "TriggerPad.ts",
  "UuidGenerator.ts",
  "XYPad.ts",
]);

type LoadedServiceModule = {
  modulePath: string;
  descriptor: ServiceDescriptor;
};

function isServiceDescriptor(value: unknown): value is ServiceDescriptor {
  if (!value || typeof value !== "object") {
    return false;
  }
  const maybe = value as Record<string, unknown>;
  return (
    typeof maybe.serviceId === "string" &&
    typeof maybe.serviceName === "string" &&
    typeof maybe.create === "function"
  );
}

function createMockApp() {
  return {
    createSubService: vi.fn(async () => null),
    getAuthenticatedUser: vi.fn(() => null),
    getServiceById: vi.fn(() => null),
    next: vi.fn(),
    notify: vi.fn(),
    removeServiceData: vi.fn(),
    restoreServiceData: vi.fn(),
    sendAction: vi.fn(),
    storeServiceData: vi.fn(),
  };
}

async function loadServiceModules(): Promise<LoadedServiceModule[]> {
  const entries = Object.entries(moduleLoaders)
    .filter(([modulePath]) => {
      const fileName = modulePath.split("/").at(-1) || "";
      if (modulePath.includes(".test.")) {
        return false;
      }
      if (!SERVICE_DESCRIPTOR_FILES.has(fileName)) {
        return false;
      }
      return true;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  const loaded: LoadedServiceModule[] = [];
  for (const [modulePath, loadModule] of entries) {
    const mod = (await Promise.race([
      loadModule(),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Timed out loading module: ${modulePath}`)),
          5000,
        );
      }),
    ])) as Record<string, unknown>;

    const descriptor = mod.default;
    if (isServiceDescriptor(descriptor)) {
      loaded.push({ modulePath, descriptor });
    }
  }

  return loaded;
}

describe("runtime browser services module contracts", () => {
  let serviceModules: LoadedServiceModule[] = [];

  beforeAll(async () => {
    if (typeof globalThis.fetch !== "function") {
      (globalThis as { fetch?: unknown }).fetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({}),
      }));
    }

    serviceModules = await loadServiceModules();
  }, 60000);

  it("finds non-UI service descriptors", () => {
    expect(serviceModules.length).toBeGreaterThan(0);
  });

  it("every discovered descriptor has valid metadata", () => {
    for (const { modulePath, descriptor } of serviceModules) {
      expect(descriptor.serviceId, `${modulePath} serviceId`).toContain(
        "hookup.to/service/",
      );
      expect(descriptor.serviceName, `${modulePath} serviceName`).not.toBe("");
      expect(typeof descriptor.create, `${modulePath} create`).toBe("function");
    }
  });

  it("all service descriptors can create a service instance", () => {
    for (const { descriptor } of serviceModules) {
      const app = createMockApp();
      const created = descriptor.create(
        app,
        "test-board",
        descriptor as unknown as Record<string, unknown>,
        `svc-${descriptor.serviceName}`,
      );

      expect(created).toBeDefined();
      expect(typeof created).toBe("object");
      expect(created.uuid).toContain(`svc-${descriptor.serviceName}`);
      expect(created.board).toBe("test-board");
      expect(created.app).toBe(app);
    }
  });

  it("all created services expose configure/process contracts", () => {
    for (const { modulePath, descriptor } of serviceModules) {
      const app = createMockApp();
      const created = descriptor.create(
        app,
        "test-board",
        descriptor as unknown as Record<string, unknown>,
        `svc-${descriptor.serviceName}`,
      );

      expect(typeof created.configure, `${modulePath} configure`).toBe(
        "function",
      );
      expect(typeof created.process, `${modulePath} process`).toBe("function");

      if (typeof created.getConfiguration === "function") {
        expect(
          typeof created.getConfiguration,
          `${modulePath} getConfiguration`,
        ).toBe("function");
      }
    }
  });
});
