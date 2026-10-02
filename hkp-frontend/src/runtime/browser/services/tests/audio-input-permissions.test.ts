import { afterEach, describe, expect, it, vi } from "vitest";

import AudioInputDescriptor from "../AudioInput";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Audio Input permissions", () => {
  it("reports a denied startup request without rejecting board construction", async () => {
    const denial = new DOMException("Permission denied", "NotAllowedError");
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(denial) },
    });
    const app = {
      notify: vi.fn(),
      next: vi.fn(),
      sendAction: vi.fn(),
    };

    const service = AudioInputDescriptor.create(
      app as any,
      "test-board",
      {} as any,
      "audio-input-1",
    );

    // Let the constructor's best-effort media request settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(app.sendAction).toHaveBeenCalledWith({
      action: "notification",
      service,
      payload: {
        type: "error",
        message: "Could not access audio input: Permission denied",
      },
    });
  });
});
