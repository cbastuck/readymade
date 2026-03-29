import { vi } from "vitest";

// Must mock Monaco BEFORE any modules that use it are imported
vi.mock("@monaco-editor/react", () => ({
  default: () => null,
  useMonaco: () => null,
  loader: {
    init: () => Promise.resolve(null),
    config: () => {},
    require: () => null,
    getMonaco: () => null,
  },
}));

// Apply matchMedia mock BEFORE any other setup to ensure it's in place
if (typeof window !== "undefined") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  })) as any;
}

if (typeof globalThis !== "undefined" && globalThis !== window) {
  (globalThis as any).matchMedia = window.matchMedia;
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock,
});

Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock,
});

Object.defineProperty(navigator, "clipboard", {
  writable: true,
  configurable: true,
  value: {
    writeText: vi.fn(),
  },
});

Object.defineProperty(window, "scrollTo", {
  writable: true,
  configurable: true,
  value: vi.fn(),
});
