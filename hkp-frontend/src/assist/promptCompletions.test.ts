import { describe, expect, it } from "vitest";
import {
  AssistPromptContext,
  buildAssistPromptCompletions,
  promptMentionStart,
} from "./promptCompletions";

const board = {
  runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
  services: {
    ui: [
      {
        uuid: "timer-one",
        serviceName: "Timer",
        serviceId: "hookup.to/service/timer",
      },
    ],
  },
  registry: {
    ui: [
      {
        serviceName: "Timer",
        serviceId: "hookup.to/service/timer",
      },
      {
        serviceName: "Monitor",
        serviceId: "hookup.to/service/monitor",
      },
    ],
    node: [
      {
        serviceName: "Monitor",
        serviceId: "hookup.to/service/monitor",
      },
    ],
  },
  availableRuntimeEngines: [
    { type: "browser", name: "Browser" },
    { type: "rest", name: "Node.js" },
  ],
} satisfies AssistPromptContext;

describe("Board Assist prompt completions", () => {
  it("offers current instances and available types as readable references", () => {
    const completions = buildAssistPromptCompletions(board);
    expect(
      completions.map(({ category, insertText }) => ({
        category,
        insertText,
      })),
    ).toEqual([
      { category: "runtime", insertText: "@runtime(ui)" },
      { category: "service", insertText: "@service(timer-one)" },
      { category: "runtime-type", insertText: "@runtime-type(Browser)" },
      { category: "runtime-type", insertText: "@runtime-type(Node.js)" },
      {
        category: "service-type",
        insertText: "@service-id(hookup.to/service/timer)",
      },
      {
        category: "service-type",
        insertText: "@service-id(hookup.to/service/monitor)",
      },
    ]);
    expect(
      completions.find(
        (item) => item.insertText === "@service-id(hookup.to/service/monitor)",
      )?.detail,
    ).toContain("ui, node");
  });

  it("finds only the unfinished mention at the caret", () => {
    expect(promptMentionStart("Change @serv")).toBe(7);
    expect(promptMentionStart("Change @service(timer-one)")).toBeNull();
    expect(promptMentionStart("email@example.com")).toBeNull();
    expect(promptMentionStart("Change (@serv")).toBe(8);
    expect(promptMentionStart("@runtime-type")).toBe(0);
  });
});
