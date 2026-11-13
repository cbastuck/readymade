import { describe, expect, it } from "vitest";

import {
  Binding,
  facadeBindings,
  siteKey,
  widgetBindings,
  WIDGET_TYPES,
} from "../bindings";
import { interpolateTemplate } from "../itemTemplate";
import { widgetServiceUuids } from "../widgetServices";
import type {
  FacadeDescriptor,
  FacadeWidget,
  LayoutItem,
} from "../types";

/**
 * What a widget sends to and shows from.
 *
 * One case per widget type. `WIDGET_TYPES` is exhaustive over `FacadeWidget`
 * (the build's type check says so), and the first test below fails for a type
 * it lists that has no case here.
 */
const cases: Record<
  FacadeWidget["type"],
  { widget: Record<string, unknown>; bindings: Binding[] }
> = {
  "message-list": {
    widget: {
      source: { serviceUuid: "thread", path: "messages" },
      composer: {
        action: { serviceUuid: "chat", configure: { send: "$$input" } },
      },
    },
    bindings: [
      { role: "shows", service: "thread", path: "messages" },
      { role: "sends", service: "chat", verb: "configure", keys: ["send"] },
    ],
  },
  "text-input": {
    widget: {
      actions: [
        { type: "set-state", key: "name" },
        { type: "process", serviceUuid: "greet", payload: { who: "$$input" } },
      ],
    },
    bindings: [
      { role: "sends", state: "name" },
      { role: "sends", service: "greet", verb: "process" },
    ],
  },
  "json-input": {
    widget: {
      mode: "object",
      defaultValue: { $state: "draft" },
      action: { serviceUuid: "store", configure: { value: "$$input" } },
    },
    bindings: [
      { role: "shows", state: "draft" },
      { role: "sends", service: "store", verb: "configure", keys: ["value"] },
    ],
  },
  editor: {
    widget: {
      source: { serviceUuid: "notes", path: "rows.0.body" },
      actions: [
        { type: "configure", serviceUuid: "notes", configure: { body: "$$input" } },
      ],
    },
    bindings: [
      { role: "shows", service: "notes", path: "rows.0.body" },
      { role: "sends", service: "notes", verb: "configure", keys: ["body"] },
    ],
  },
  "status-indicator": {
    widget: { source: { serviceUuid: "link", path: "status" } },
    bindings: [{ role: "shows", service: "link", path: "status" }],
  },
  text: {
    widget: {
      source: { serviceUuid: "take-hour", path: "error" },
      value: { $state: "reason" },
    },
    bindings: [
      { role: "shows", service: "take-hour", path: "error" },
      { role: "shows", state: "reason" },
    ],
  },
  button: {
    widget: {
      label: "Book",
      indicator: { source: { serviceUuid: "mic", path: "isRecording" } },
      actions: [
        { type: "confirm", question: "Book {{item.court}}?" },
        {
          type: "process",
          serviceUuid: "book",
          payload: { name: { $state: "name" }, at: { $now: true } },
        },
        { type: "show-panel", panel: "bookings" },
        { type: "board", action: "partner-board-qr" },
      ],
    },
    bindings: [
      { role: "shows", service: "mic", path: "isRecording" },
      { role: "sends", service: "book", verb: "process" },
      { role: "shows", state: "name" },
    ],
  },
  "qr-code": {
    widget: { source: { serviceUuid: "peer", path: "__hkpMount" } },
    bindings: [{ role: "shows", service: "peer", path: "__hkpMount" }],
  },
  "file-pick": {
    widget: { action: { serviceUuid: "upload" }, progressServiceUuid: "uploading" },
    bindings: [
      { role: "sends", service: "upload", verb: "send" },
      { role: "shows", service: "uploading" },
    ],
  },
  knob: {
    widget: {
      min: 0,
      max: 1,
      defaultValue: 0.5,
      action: { serviceUuid: "gain", configure: { level: "{{value}}" } },
    },
    bindings: [
      { role: "sends", service: "gain", verb: "configure", keys: ["level"] },
    ],
  },
  "level-meter": {
    widget: {
      source: { serviceUuid: "meter", path: "rms" },
      thresholdKnobServiceUuid: "gate",
    },
    bindings: [
      { role: "shows", service: "meter", path: "rms" },
      { role: "shows", service: "gate" },
    ],
  },
  "bipolar-meter": {
    widget: { source: { serviceUuid: "balance" } },
    bindings: [{ role: "shows", service: "balance" }],
  },
  "line-chart": {
    widget: { source: { serviceUuid: "prices", path: "rows" } },
    bindings: [{ role: "shows", service: "prices", path: "rows" }],
  },
  layout: {
    widget: {
      direction: "column",
      summary: { $state: "headers" },
      items: [{ type: "canvas", serviceUuid: "inner" }],
    },
    bindings: [{ role: "shows", state: "headers" }],
  },
  canvas: {
    widget: { serviceUuid: "draw" },
    bindings: [{ role: "shows", service: "draw", surface: true }],
  },
  camera: {
    widget: { serviceUuid: "cam", preview: false },
    bindings: [{ role: "sends", service: "cam", verb: "surface" }],
  },
  detect: {
    widget: { serviceUuid: "seen" },
    bindings: [{ role: "shows", service: "seen", surface: true }],
  },
  "xy-pad": {
    widget: { serviceUuid: "pad" },
    bindings: [
      {
        role: "sends",
        service: "pad",
        verb: "configure",
        keys: ["position", "eventType"],
      },
      { role: "shows", service: "pad", surface: true },
    ],
  },
  "data-table": {
    widget: {
      source: { serviceUuid: "rows" },
      selectable: true,
      cellActions: [
        { type: "prompt", question: "New value", defaultValue: "{{item.value}}" },
        {
          type: "configure",
          serviceUuid: "write",
          configure: { set: { column: "{{item.column}}", value: "$$input" } },
        },
      ],
    },
    bindings: [
      { role: "sends", state: "selection" },
      { role: "shows", service: "rows" },
      { role: "sends", service: "write", verb: "configure", keys: ["set"] },
    ],
  },
  repeat: {
    widget: {
      items: { $state: "meetings" },
      template: {
        type: "button",
        label: "{{item.title}}",
        actions: [{ type: "set-state", key: "meeting", value: "{{item.id}}" }],
      },
    },
    bindings: [{ role: "shows", state: "meetings" }],
  },
  "audio-player": {
    widget: {
      source: { serviceUuid: "episodes", path: "rows" },
      url: "{{item.url}}",
      trackActions: [
        {
          label: "Remove",
          actions: [
            { type: "process", serviceUuid: "remove", payload: { slug: "{{item.slug}}" } },
          ],
        },
      ],
    },
    bindings: [
      { role: "shows", service: "episodes", path: "rows" },
      { role: "sends", service: "remove", verb: "process" },
    ],
  },
  calendar: {
    widget: {
      source: { serviceUuid: "cells" },
      action: { serviceUuid: "take-hour", configure: { hour: "{{item.hour}}" } },
    },
    bindings: [
      { role: "shows", service: "cells" },
      { role: "sends", service: "take-hour", verb: "configure", keys: ["hour"] },
    ],
  },
  swimlane: {
    widget: {
      laneId: 1,
      title: "Kept",
      source: { serviceUuid: "cards" },
      except: { source: { serviceUuid: "kept" } },
      selectable: true,
      selectionState: "article",
      moveActions: [
        { type: "process", serviceUuid: "move", payload: { to: "{{item.toLaneId}}" } },
      ],
      cardActions: [
        {
          label: "Retry",
          actions: [
            { type: "configure", serviceUuid: "retry", configure: { id: "{{item.cardId}}" } },
          ],
        },
      ],
    },
    bindings: [
      { role: "sends", state: "article" },
      { role: "shows", service: "cards" },
      { role: "shows", service: "kept" },
      { role: "sends", service: "move", verb: "process" },
      { role: "sends", service: "retry", verb: "configure", keys: ["id"] },
    ],
  },
};

describe("what a widget sends to and shows from", () => {
  it("has a case for every widget type", () => {
    expect(Object.keys(cases).sort()).toEqual([...WIDGET_TYPES].sort());
  });

  for (const [type, { widget, bindings }] of Object.entries(cases)) {
    it(type, () => {
      expect(widgetBindings({ type, ...widget } as unknown as LayoutItem)).toEqual(
        bindings,
      );
    });
  }

  it("leaves a payload's addresses alone, but reads the state in it", () => {
    expect(
      widgetBindings({
        type: "button",
        label: "Forward",
        action: {
          serviceUuid: "play",
          configure: {
            serviceUuid: "something-on-another-board",
            source: { serviceUuid: "elsewhere" },
            who: { $state: "name" },
          },
        },
      } as unknown as LayoutItem),
    ).toEqual([
      {
        role: "sends",
        service: "play",
        verb: "configure",
        keys: ["serviceUuid", "source", "who"],
      },
      { role: "shows", state: "name" },
    ]);
  });

  it("takes a repeat item's bindings once the item is substituted", () => {
    const template = {
      type: "button",
      label: "{{item.court}}",
      actions: [
        { type: "configure", serviceUuid: "{{item.service}}", configure: { hour: "{{item.hour}}" } },
      ],
    };
    const item = interpolateTemplate(template, {
      court: "Court 2",
      service: "court-2",
      hour: 12,
    }) as LayoutItem;

    expect(widgetBindings(item)).toEqual([
      { role: "sends", service: "court-2", verb: "configure", keys: ["hour"] },
    ]);
  });

  it("keeps a nested scoped address whole", () => {
    expect(
      widgetBindings({
        type: "data-table",
        source: { serviceUuid: "read.kept-articles", path: "rows" },
      } as unknown as LayoutItem),
    ).toEqual([{ role: "shows", service: "read.kept-articles", path: "rows" }]);
  });

  it("lists a binding written twice once", () => {
    expect(
      widgetBindings({
        type: "button",
        label: "Twice",
        actions: [
          { type: "process", serviceUuid: "go" },
          { type: "process", serviceUuid: "go", payload: 2 },
        ],
      } as unknown as LayoutItem),
    ).toEqual([{ role: "sends", service: "go", verb: "process" }]);
  });

  it("projects to the services a widget names, each once", () => {
    expect(
      widgetServiceUuids({ type: "xy-pad", serviceUuid: "pad" } as LayoutItem),
    ).toEqual(["pad"]);
    expect(
      widgetServiceUuids({
        type: "swimlane",
        ...cases.swimlane.widget,
      } as unknown as LayoutItem),
    ).toEqual(["cards", "kept", "move", "retry"]);
  });
});

describe("the facade's own bindings", () => {
  const facade = {
    layout: "columns",
    state: { name: "", meeting: null },
    init: [
      { type: "configure", serviceUuid: "poll", configure: { meeting: { $state: "meeting" } } },
      { type: "show-panel", panel: "dates" },
    ],
    notices: [{ source: { serviceUuid: "take-hour", path: "error" }, tone: "error" }],
    panels: [
      {
        id: "form",
        layout: {
          direction: "column",
          items: [
            {
              type: "text-input",
              label: "Your name",
              actions: [{ type: "set-state", key: "name" }],
            },
            {
              type: "button",
              label: "Book",
              actions: [
                { type: "process", serviceUuid: "book", payload: { name: { $state: "name" } } },
              ],
            },
          ],
        },
      },
      {
        id: "meetings",
        layout: {
          type: "repeat",
          source: { serviceUuid: "list", path: "rows" },
          template: {
            type: "button",
            label: "{{item.title}}",
            actions: [{ type: "set-state", key: "meeting", value: "{{item.id}}" }],
          },
        },
      },
    ],
  } as unknown as FacadeDescriptor;

  const bindings = facadeBindings(facade);

  it("lists the init actions that bind, by their place in `init`", () => {
    expect(bindings.init).toEqual([
      {
        site: { kind: "init", index: 0 },
        bindings: [
          { role: "sends", service: "poll", verb: "configure", keys: ["meeting"] },
          { role: "shows", state: "meeting" },
        ],
      },
    ]);
  });

  it("lists each notice's source", () => {
    expect(bindings.notices).toEqual([
      {
        site: { kind: "notice", index: 0 },
        bindings: [{ role: "shows", service: "take-hour", path: "error" }],
        tone: "error",
        message: undefined,
      },
    ]);
  });

  it("indexes every state key to who writes and who reads it", () => {
    expect(Object.keys(bindings.state).sort()).toEqual(["meeting", "name"]);

    const name = bindings.state.name;
    expect(name.seeded).toBe(true);
    expect(name.writers.map(siteKey)).toEqual(["form/0"]);
    expect(name.writers[0]).toMatchObject({ type: "text-input", label: "Your name" });
    expect(name.readers.map(siteKey)).toEqual(["form/1"]);

    // A repeat's template writes once per item, and is one site for all of them.
    const meeting = bindings.state.meeting;
    expect(meeting.writers.map(siteKey)).toEqual(["meetings/template"]);
    expect(meeting.readers.map(siteKey)).toEqual(["init/0"]);
  });

  it("indexes a key nobody seeded", () => {
    const unseeded = facadeBindings({
      layout: "single",
      panels: [
        {
          id: "p",
          layout: { type: "text", value: { $state: "later" } } as LayoutItem,
        },
      ],
    });
    expect(unseeded.state.later).toEqual({
      seeded: false,
      writers: [],
      readers: [{ kind: "widget", panel: "p", path: [], type: "text", label: undefined }],
    });
  });
});
