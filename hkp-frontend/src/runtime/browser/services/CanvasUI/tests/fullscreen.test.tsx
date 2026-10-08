import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CanvasUI from "../index";
import { ServiceUIProps } from "../../../../../types";

vi.mock("../../../../../ui-components/service/ServiceUI", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

afterEach(cleanup);

describe("Canvas fullscreen", () => {
  it("renders outside a zoomed runtime", () => {
    const service = { fullscreen: true } as ServiceUIProps["service"];
    const { container } = render(
      <div style={{ zoom: "50%" }}>
        <CanvasUI service={service} />
      </div>,
    );

    const canvas = document.body.querySelector("canvas")!;
    expect(canvas.parentElement).toBe(document.body);
    expect(container.contains(canvas)).toBe(false);
  });
});
