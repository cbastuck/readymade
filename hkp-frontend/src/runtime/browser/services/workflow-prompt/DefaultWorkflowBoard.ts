import { BoardDescriptor } from "hkp-frontend/src/types";

export const DEFAULT_WORKFLOW_DESCRIPTION = [
  "Hello world workflow:",
  "Create a browser-only board that animates the text HKP in a circle on a canvas.",
  "Use a timer to drive animation updates, a map service to emit a text drawing template, and a canvas service to render it.",
].join("\n");

export const DEFAULT_GENERATED_BOARD: BoardDescriptor = {
  boardName: "Circle Text",
  runtimes: [
    {
      id: "rt-browser-1",
      name: "Browser Runtime",
      type: "browser",
      state: {
        wrapServices: false,
        minimized: false,
      },
    },
  ],
  services: {
    "rt-browser-1": [
      {
        uuid: "svc-timer-1",
        serviceId: "hookup.to/service/timer",
        serviceName: "Timer",
        state: {
          periodicValue: 50,
          periodicUnit: "ms",
          periodic: true,
          running: true,
        },
      },
      {
        uuid: "svc-map-1",
        serviceId: "hookup.to/service/map",
        serviceName: "Map",
        state: {
          template: {
            type: "text",
            text: "Hello World",
            color: "#3b82f6",
            font: "bold 22px Arial",
            "x=": "round(200 + 120 * sin(params.triggerCount * 0.05 + 1.5708))",
            "y=": "round(150 + 120 * sin(params.triggerCount * 0.05))",
          },
          mode: "replace",
        },
      },
      {
        uuid: "svc-canvas-1",
        serviceId: "hookup.to/service/canvas",
        serviceName: "Canvas",
        state: {
          size: [400, 300],
          clearOnRedraw: true,
          resizable: true,
        },
      },
    ],
  },
};

export function isBoardDescriptorEmpty(board: any): boolean {
  console.log("CHECK", board);
  if (!board || typeof board !== "object") {
    return true;
  }

  const runtimes = Array.isArray(board.runtimes) ? board.runtimes : [];
  if (runtimes.length > 0) {
    return false;
  }

  const services = board.services;
  if (!services || typeof services !== "object") {
    return true;
  }

  for (const runtimeId of Object.keys(services)) {
    const runtimeServices = services[runtimeId];
    if (Array.isArray(runtimeServices) && runtimeServices.length > 0) {
      return false;
    }
  }

  console.log("THE BOAR DIS EMTPY");
  return true;
}
