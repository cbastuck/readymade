import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import SubServicePipelineUI from "../SubServicePipelineUI";
import { ServiceInstance } from "hkp-frontend/src/types";

/**
 * A service nested in a pipeline must get the same UI it would get at the top
 * level of its runtime.
 *
 * A pipeline entry carries only `serviceId`, `instanceId` and `state` — never
 * the version or capabilities, which live in the runtime's registry. Looking a
 * nested service up by id alone therefore silently resolved a versioned service
 * to the UI of its older revision: a Map inside an http-server-subservices
 * showed the pre-v1 panel while the same Map beside it showed the current one.
 *
 * The pipeline is folded until asked for, so these expand it: the lookup is
 * what is under test, not when the strip is drawn.
 */

function pipelineService(pipeline: Array<Record<string, unknown>>) {
  return {
    uuid: "host-1",
    serviceId: "http-server-subservices",
    serviceName: "Server",
    state: { pipeline },
    configure: vi.fn(),
    app: {
      listAvailableServices: () => [
        { serviceId: "map", serviceName: "Map", version: "v1" },
        { serviceId: "monitor", serviceName: "Monitor" },
      ],
    },
  } as unknown as ServiceInstance;
}

describe("UI lookup for nested services", () => {
  it("looks a nested service up by id and version", () => {
    const findServiceUI = vi.fn(() => null);

    render(
      <SubServicePipelineUI
        service={pipelineService([{ serviceId: "map", instanceId: "inner" }])}
        findServiceUI={findServiceUI}
        defaultCollapsed={false}
      />,
    );

    expect(findServiceUI).toHaveBeenCalledWith({
      serviceId: "map",
      version: "v1",
      capabilities: undefined,
    });
  });

  it("passes no version for a service the registry does not version", () => {
    const findServiceUI = vi.fn(() => null);

    render(
      <SubServicePipelineUI
        service={pipelineService([
          { serviceId: "monitor", instanceId: "inner" },
        ])}
        findServiceUI={findServiceUI}
        defaultCollapsed={false}
      />,
    );

    expect(findServiceUI).toHaveBeenCalledWith({
      serviceId: "monitor",
      version: undefined,
      capabilities: undefined,
    });
  });
});
