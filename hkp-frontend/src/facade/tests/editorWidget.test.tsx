import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { LayoutItem } from "../types";
import { LayoutNode } from "../panels/LayoutNode";
import { FacadeStateContext } from "../FacadeStateContext";
import notesBoard from "../../../../boards/notes-demo-board.json";
import { defaultRegistry } from "../../runtime/browser/registry/Default";
import SqlDescriptor from "../../runtime/browser/services/Sql";

vi.mock("hkp-frontend/src/components/shared/Editor", () => ({
  default: ({
    value,
    onChange,
    readOnly,
    language,
    options,
  }: {
    value: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
    language?: string;
    options?: { ariaLabel?: string; placeholder?: string };
  }) => (
    <textarea
      aria-label={options?.ariaLabel ?? "Editor"}
      placeholder={options?.placeholder}
      data-language={language}
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

const said: Record<string, unknown> = {};

vi.mock("../panels/renderers/StatusIndicatorRenderer", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../panels/renderers/StatusIndicatorRenderer")
  >()),
  useNotificationValue: (
    _ctx: unknown,
    source: { serviceUuid: string; path?: string } | undefined,
  ) => {
    if (!source) {
      return undefined;
    }
    const value = said[source.serviceUuid];
    return source.path
      ? source.path.split(".").reduce<any>((cur, key) => cur?.[key], value)
      : value;
  },
}));

const processed: Array<{ serviceUuid: string; payload: unknown }> = [];

vi.mock("../boardServices", () => ({
  findService: () => null,
  processService: (_ctx: unknown, serviceUuid: string, payload: unknown) => {
    processed.push({ serviceUuid, payload });
  },
}));

const boardContext = {
  scopes: {},
  services: {},
  runtimes: [],
} as unknown as BoardContextState;

beforeEach(() => {
  processed.length = 0;
  for (const key of Object.keys(said)) {
    delete said[key];
  }
});

describe("the editor facade widget", () => {
  const widget: LayoutItem = {
    type: "editor",
    label: "Note body",
    language: "markdown",
    placeholder: "Write a note…",
    submitLabel: "Save note",
    source: {
      serviceUuid: "active-note",
      path: "rows.0.body",
    },
    actions: [
      {
        type: "process",
        serviceUuid: "save-note",
        payload: { body: "$$input" },
      },
    ],
  };

  it("loads text from its source, updates when another note is opened, and saves with button or Ctrl+S", async () => {
    said["active-note"] = { rows: [{ body: "# First note\nHello" }] };

    const { rerender } = render(
      <LayoutNode
        item={widget}
        boardContext={boardContext}
        panelContext={{ knobValues: {}, onKnobChange: () => {} }}
      />,
    );

    const editor = screen.getByLabelText("Note body") as HTMLTextAreaElement;
    expect(editor.value).toBe("# First note\nHello");
    expect(editor.getAttribute("data-language")).toBe("markdown");

    // Edit the note and save via button
    fireEvent.change(editor, { target: { value: "# First note\nUpdated text" } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() => {
      expect(processed).toEqual([
        {
          serviceUuid: "save-note",
          payload: { body: "# First note\nUpdated text" },
        },
      ]);
    });

    // Edit again and save via Ctrl+S
    processed.length = 0;
    fireEvent.change(editor, { target: { value: "# First note\nSaved with shortcut" } });
    fireEvent.keyDown(editor, { key: "s", ctrlKey: true });

    await waitFor(() => {
      expect(processed).toEqual([
        {
          serviceUuid: "save-note",
          payload: { body: "# First note\nSaved with shortcut" },
        },
      ]);
    });

    // Switching to another note in the sidebar updates the source and replaces the editor content
    said["active-note"] = { rows: [{ body: "# Second note\nDifferent content" }] };
    rerender(
      <LayoutNode
        item={widget}
        boardContext={boardContext}
        panelContext={{ knobValues: {}, onKnobChange: () => {} }}
      />,
    );

    expect(editor.value).toBe("# Second note\nDifferent content");
  });
});

describe("the notes demo board", () => {
  it("uses only browser services and wires sidebar + editor panels", () => {
    expect(notesBoard.runtimes).toHaveLength(1);
    expect(notesBoard.runtimes[0].type).toBe("browser");

    const available = new Set(defaultRegistry.map((svc) => svc.serviceId));
    for (const svc of notesBoard.services.notes) {
      expect(available).toContain(svc.serviceId);
    }

    const declaredUuids = new Set(notesBoard.services.notes.map((s) => s.uuid));
    for (const notice of notesBoard.facade.notices) {
      expect(declaredUuids).toContain(notice.source.serviceUuid);
    }
  });

  it("renders the sidebar note list and the open note in the Monaco editor", async () => {
    said["all-notes"] = {
      rows: [
        {
          id: "welcome",
          title: "Welcome to Notes",
          updated: "2026-11-12 10:00",
          excerpt: "Write in Markdown",
          current: 1,
          deletePrompt: 'Delete "Welcome to Notes"?',
        },
        {
          id: "ideas",
          title: "Scratchpad & ideas",
          updated: "2026-11-12 09:00",
          excerpt: "A second note",
          current: 0,
          deletePrompt: 'Delete "Scratchpad & ideas"?',
        },
      ],
    };
    said["active-note"] = {
      rows: [
        {
          id: "welcome",
          title: "Welcome to Notes",
          body: "# Welcome to Notes\n\nBody text",
          updated: "2026-11-12 10:00:00",
          byline: "Updated 2026-11-12 10:00",
          deletePrompt: 'Delete "Welcome to Notes"?',
        },
      ],
    };

    const setState = vi.fn();
    const [sidebar, editorPanel] = notesBoard.facade.panels;

    render(
      <FacadeStateContext.Provider
        value={{ state: { noteId: "welcome" }, setState }}
      >
        <div>
          <LayoutNode
            item={sidebar.layout as unknown as LayoutItem}
            boardContext={boardContext}
            panelContext={{ knobValues: {}, onKnobChange: () => {} }}
          />
          <LayoutNode
            item={editorPanel.layout as unknown as LayoutItem}
            boardContext={boardContext}
            panelContext={{ knobValues: {}, onKnobChange: () => {} }}
          />
        </div>
      </FacadeStateContext.Provider>,
    );

    // Sidebar lists both notes and marks the open one as selected
    const welcomeBtn = screen.getByRole("button", { name: "Welcome to Notes" });
    const ideasBtn = screen.getByRole("button", { name: "Scratchpad & ideas" });
    expect(welcomeBtn.getAttribute("aria-pressed")).toBe("true");
    expect(ideasBtn.getAttribute("aria-pressed")).toBe("false");

    // Clicking the other note in the sidebar selects it and runs the pipeline
    fireEvent.click(ideasBtn);
    await waitFor(() => {
      expect(setState).toHaveBeenCalledWith("noteId", "ideas");
      expect(processed).toContainEqual({
        serviceUuid: "create-note",
        payload: { intent: "open", noteId: "ideas" },
      });
    });

    // Editor panel shows the active note's body and saves edits
    const monaco = screen.getByPlaceholderText(
      "Write your note in Markdown…",
    ) as HTMLTextAreaElement;
    expect(monaco.value).toBe("# Welcome to Notes\n\nBody text");

    processed.length = 0;
    fireEvent.change(monaco, { target: { value: "# Updated note body" } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() => {
      expect(processed).toEqual([
        {
          serviceUuid: "create-note",
          payload: {
            intent: "save",
            noteId: "welcome",
            body: "# Updated note body",
          },
        },
      ]);
    });
  });

  it("runs the notes SQL pipeline end-to-end (seed, open, create, save, rename, delete)", async () => {
    const dbName = `notes-test-${Date.now()}`;
    const sqlSteps = notesBoard.services.notes.filter(
      (svc) => svc.serviceId === "sql",
    );

    const notified: Record<string, any> = {};
    const instances = sqlSteps.map((desc) => {
      const app = {
        notify: (_svc: unknown, data: unknown) => {
          notified[desc.uuid] = data;
        },
        log: () => {},
        next: () => {},
        sendAction: () => {},
      };
      const instance = SqlDescriptor.create(
        app as any,
        "notes",
        SqlDescriptor as any,
        desc.uuid,
      );
      instance.configure({ ...desc.state, database: dbName });
      return instance;
    });

    const runPipeline = async (payload: Record<string, unknown>) => {
      let current: any = payload;
      for (const svc of instances) {
        current = await svc.process(current);
      }
      return current;
    };

    // 1. Initial load seeds the starter notes and opens the newest one
    await runPipeline({ intent: "none", noteId: "" });
    expect(notified["all-notes"].count).toBe(2);
    expect(notified["active-note"].rows[0].id).toBe("welcome");
    expect(notified["active-note"].rows[0].title).toBe("Welcome to Notes");

    // 2. Open the second note
    await runPipeline({ intent: "open", noteId: "ideas" });
    expect(notified["active-note"].rows[0].id).toBe("ideas");
    expect(
      notified["all-notes"].rows.find((r: any) => r.id === "ideas").current,
    ).toBe(1);

    // 3. Create a new note
    await runPipeline({
      intent: "create",
      id: "note-3",
      noteId: "",
      title: "Project Plan",
    });
    expect(notified["all-notes"].count).toBe(3);
    expect(notified["active-note"].rows[0]).toMatchObject({
      id: "note-3",
      title: "Project Plan",
      body: "# Project Plan\n\n",
    });

    // 4. Save edited Markdown body for the note
    await runPipeline({
      intent: "save",
      noteId: "note-3",
      body: "# Project Plan\n\n- Step 1\n- Step 2",
    });
    expect(notified["active-note"].rows[0].body).toBe(
      "# Project Plan\n\n- Step 1\n- Step 2",
    );

    // 5. Rename the note
    await runPipeline({
      intent: "rename",
      noteId: "note-3",
      title: "Updated Project Plan",
    });
    expect(notified["active-note"].rows[0].title).toBe("Updated Project Plan");

    // 6. Delete the note
    await runPipeline({
      intent: "delete",
      id: "note-3",
      noteId: "",
    });
    expect(notified["all-notes"].count).toBe(2);
    expect(notified["active-note"].rows[0].id).toBe("welcome");
  });
});
