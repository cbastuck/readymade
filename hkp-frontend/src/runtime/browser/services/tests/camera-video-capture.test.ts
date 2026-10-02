import { describe, expect, it, vi } from "vitest";

import { startVideoStream } from "../camera/videoCapture";

describe("camera video capture", () => {
  it("releases a granted camera when the video element cannot play it", async () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }],
    } as unknown as MediaStream;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const video = document.createElement("video");
    const failure = new DOMException("Not supported", "NotSupportedError");
    vi.spyOn(video, "play").mockRejectedValue(failure);

    await expect(startVideoStream(video)).rejects.toBe(failure);

    expect(stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });
});
