import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import {
  BoardCtx,
  type BoardContextState,
} from "hkp-frontend/src/BoardContext";
import RunParamsDialog from "hkp-frontend/src/ui-components/runtime-ui/RunParamsDialog";

/**
 * The ways to write the input a run starts with.
 *
 * Fields build an object a name at a time, which is what the dialog could
 * always do. Text is the payload itself — a request body pasted out of an
 * API's reference manual — which a table of names and values cannot express
 * and which nobody should have to quote into a single cell. JSON is a value
 * neither can say — a list of items for an Iterator — parsed before it is sent.
 * File is a file itself, sent as the File.
 */

function renderDialog(boardName?: string) {
  const onRun = vi.fn();
  const dialog = <RunParamsDialog open onClose={() => {}} onRun={onRun} />;
  const result = render(
    boardName === undefined ? (
      dialog
    ) : (
      <BoardCtx.Provider value={{ boardName } as BoardContextState}>
        {dialog}
      </BoardCtx.Provider>
    ),
  );
  return Object.assign(onRun, { unmount: result.unmount });
}

const run = () => fireEvent.click(screen.getByText("Process"));

/** The picker is offered in File mode, so picking starts there. */
const pick = async (file: File) => {
  fireEvent.click(screen.getByLabelText("File"));
  await act(async () => {
    fireEvent.change(screen.getByTestId("run-params-file-input"), {
      target: { files: [file] },
    });
  });
};

const drop = async (file: File) => {
  await act(async () => {
    fireEvent.drop(screen.getByRole("dialog"), {
      dataTransfer: { types: ["Files"], files: [file] },
    });
  });
};

const openSaved = async () => {
  fireEvent.keyDown(screen.getByText("Load a saved payload…"), {
    key: "Enter",
  });
  await screen.findAllByRole("menuitem");
};

const savedItem = (name: string) =>
  screen.getByRole("menuitem", { name: new RegExp(`^${name}`) });

const loadSaved = async (name: string) => {
  await openSaved();
  fireEvent.click(savedItem(name));
};

const saveAs = (name: string) => {
  fireEvent.click(screen.getByText("Save"));
  fireEvent.change(screen.getByLabelText("Payload name"), {
    target: { value: name },
  });
  fireEvent.click(screen.getByText("Save"));
};

beforeEach(() => localStorage.clear());

describe("RunParamsDialog", () => {
  it("starts on the fields it has always offered", () => {
    renderDialog();

    expect(screen.getByLabelText("Fields").getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.queryByLabelText("Run parameters as text")).toBeNull();
  });

  it("sends text exactly as typed, without parsing it", () => {
    const onRun = renderDialog();
    const body = '{"model": "deepseek-v4-flash"}';

    fireEvent.click(screen.getByLabelText("Text"));
    fireEvent.change(screen.getByLabelText("Run parameters as text"), {
      target: { value: body },
    });
    run();

    // The string, not the object it happens to spell: a service reading text
    // gets what was pasted, byte for byte.
    expect(onRun).toHaveBeenCalledWith(body);
  });

  it("does not offer to run an empty text payload", () => {
    renderDialog();

    fireEvent.click(screen.getByLabelText("Text"));

    expect(screen.getByText("Process").closest("button")?.disabled).toBe(true);
  });

  it("sends JSON as the value it spells, so a list arrives as a list", () => {
    const onRun = renderDialog();

    fireEvent.click(screen.getByLabelText("JSON"));
    fireEvent.change(screen.getByLabelText("Run parameters as JSON"), {
      target: { value: '[1, "two", {"three": 3}]' },
    });
    run();

    expect(onRun).toHaveBeenCalledWith([1, "two", { three: 3 }]);
  });

  it("reads a JS literal as the JSON it stands for", () => {
    const onRun = renderDialog();

    fireEvent.click(screen.getByLabelText("JSON"));
    fireEvent.change(screen.getByLabelText("Run parameters as JSON"), {
      target: { value: "[{type: 1}, {type: 2, name: 'b'},]" },
    });
    run();

    expect(onRun).toHaveBeenCalledWith([{ type: 1 }, { type: 2, name: "b" }]);
  });

  it("reads the quotes macOS substitutes while typing as plain quotes", () => {
    const onRun = renderDialog();

    fireEvent.click(screen.getByLabelText("JSON"));
    fireEvent.change(screen.getByLabelText("Run parameters as JSON"), {
      target: { value: "[{“name”: “a”}]" },
    });
    run();

    expect(onRun).toHaveBeenCalledWith([{ name: "a" }]);
  });

  it("leaves curly quotes inside strings of JSON that already parses", () => {
    const onRun = renderDialog();

    fireEvent.click(screen.getByLabelText("JSON"));
    fireEvent.change(screen.getByLabelText("Run parameters as JSON"), {
      target: { value: '["“quoted”"]' },
    });
    run();

    expect(onRun).toHaveBeenCalledWith(["“quoted”"]);
  });

  it("turns off text substitution where code is typed", () => {
    renderDialog();

    fireEvent.click(screen.getByLabelText("JSON"));

    const area = screen.getByLabelText("Run parameters as JSON");
    expect(area.getAttribute("spellcheck")).toBe("false");
    expect(area.getAttribute("autocorrect")).toBe("off");
  });

  it("does not offer to run JSON that does not parse", () => {
    const onRun = renderDialog();

    fireEvent.click(screen.getByLabelText("JSON"));
    fireEvent.change(screen.getByLabelText("Run parameters as JSON"), {
      target: { value: "[1, 2" },
    });

    expect(screen.getByText("Process").closest("button")?.disabled).toBe(true);
    run();
    expect(onRun).not.toHaveBeenCalled();
  });

  it("keeps what was written when the other way of writing it is looked at", () => {
    const onRun = renderDialog();

    fireEvent.click(screen.getByLabelText("Text"));
    fireEvent.change(screen.getByLabelText("Run parameters as text"), {
      target: { value: "kept" },
    });
    fireEvent.click(screen.getByLabelText("Fields"));
    fireEvent.click(screen.getByLabelText("Text"));

    expect(
      (screen.getByLabelText("Run parameters as text") as HTMLTextAreaElement)
        .value,
    ).toBe("kept");

    run();
    expect(onRun).toHaveBeenCalledWith("kept");
  });

  describe("files", () => {
    it("opens a JSON file in the JSON editor, to look at before running", async () => {
      const onRun = renderDialog();

      await pick(
        new File(["[{type: 1}]"], "items.json", { type: "application/json" }),
      );

      expect(
        (
          (await screen.findByLabelText(
            "Run parameters as JSON",
          )) as HTMLTextAreaElement
        ).value,
      ).toBe("[{type: 1}]");
      run();
      expect(onRun).toHaveBeenCalledWith([{ type: 1 }]);
    });

    it("opens a text file in the text editor", async () => {
      renderDialog();

      await pick(new File(["hello"], "note.txt", { type: "text/plain" }));

      expect(
        (
          (await screen.findByLabelText(
            "Run parameters as text",
          )) as HTMLTextAreaElement
        ).value,
      ).toBe("hello");
    });

    it("sends any other file as the file itself", async () => {
      const onRun = renderDialog();
      const image = new File([new Uint8Array([1, 2, 3])], "photo.png", {
        type: "image/png",
      });

      await pick(image);

      expect(screen.getByText("photo.png")).toBeTruthy();
      run();
      expect(onRun).toHaveBeenCalledWith(image);
    });

    it("sends a JSON file as the file when it is not to be opened", async () => {
      const onRun = renderDialog();
      const items = new File(["[1]"], "items.json", {
        type: "application/json",
      });

      fireEvent.click(screen.getByLabelText("File"));
      fireEvent.click(
        screen.getByLabelText("Open JSON and text files in the editor"),
      );
      await pick(items);

      expect(screen.getByText("items.json")).toBeTruthy();
      run();
      expect(onRun).toHaveBeenCalledWith(items);
    });

    it("offers no picker outside File mode", () => {
      renderDialog();

      expect(screen.queryByTestId("run-params-file-input")).toBeNull();
      expect(screen.queryByText("Choose a file")).toBeNull();
    });

    it("takes a file dropped anywhere on the dialog", async () => {
      const onRun = renderDialog();
      const audio = new File([new Uint8Array([0])], "take.wav", {
        type: "audio/wav",
      });

      await drop(audio);

      run();
      expect(onRun).toHaveBeenCalledWith(audio);
    });

    it("does not offer to run the file mode before a file is chosen", () => {
      renderDialog();

      fireEvent.click(screen.getByLabelText("File"));

      expect(screen.getByText("Process").closest("button")?.disabled).toBe(
        true,
      );
    });
  });

  describe("saved payloads", () => {
    const textArea = () =>
      screen.getByLabelText("Run parameters as text") as HTMLTextAreaElement;
    const writeText = (value: string) =>
      fireEvent.change(textArea(), { target: { value } });

    it("brings a saved payload back as it was written", async () => {
      const onRun = renderDialog("board-a");

      fireEvent.click(screen.getByLabelText("JSON"));
      fireEvent.change(screen.getByLabelText("Run parameters as JSON"), {
        target: { value: "[{type: 1}] // the happy path" },
      });
      saveAs("happy");

      fireEvent.change(screen.getByLabelText("Run parameters as JSON"), {
        target: { value: "[]" },
      });
      fireEvent.click(screen.getByLabelText("Fields"));
      await loadSaved("happy");

      // The source, comment and all, not a reformatted copy.
      expect(
        (screen.getByLabelText("Run parameters as JSON") as HTMLTextAreaElement)
          .value,
      ).toBe("[{type: 1}] // the happy path");
      run();
      expect(onRun).toHaveBeenCalledWith([{ type: 1 }]);
    });

    it("loads the one just loaded again, undoing edits since", async () => {
      renderDialog("board-a");

      fireEvent.click(screen.getByLabelText("Text"));
      writeText("saved");
      saveAs("case");
      await loadSaved("case");
      writeText("edited");
      await loadSaved("case");

      expect(textArea().value).toBe("saved");
    });

    it("claims the Enter that saves, so a native shell does not beep", async () => {
      renderDialog("board-a");

      fireEvent.click(screen.getByText("Save"));
      fireEvent.change(screen.getByLabelText("Payload name"), {
        target: { value: "by-enter" },
      });
      // fireEvent hands back what dispatchEvent did: false once the default
      // was prevented, which is the signal a native shell reads as handled.
      const claimed = !fireEvent.keyDown(
        screen.getByLabelText("Payload name"),
        {
          key: "Enter",
        },
      );

      expect(claimed).toBe(true);
      await openSaved();
      expect(savedItem("by-enter")).toBeTruthy();
    });

    it("keeps them for the board they were saved on, across openings", async () => {
      const first = renderDialog("board-a");
      fireEvent.click(screen.getByLabelText("Text"));
      writeText("kept");
      saveAs("case");
      first.unmount();

      // Nothing kept for this board, so nothing to choose from.
      const other = renderDialog("board-b");
      expect(screen.queryByText("Load a saved payload…")).toBeNull();
      other.unmount();

      renderDialog("board-a");
      await openSaved();
      expect(savedItem("case")).toBeTruthy();
    });

    it("replaces one saved under a name already taken", async () => {
      renderDialog("board-a");

      fireEvent.click(screen.getByLabelText("Text"));
      writeText("one");
      saveAs("case");
      writeText("two");
      saveAs("case");
      writeText("");

      await openSaved();
      expect(screen.getAllByRole("menuitem")).toHaveLength(1);
      fireEvent.click(savedItem("case"));
      expect(textArea().value).toBe("two");
    });

    it("forgets one when asked, without loading it", async () => {
      renderDialog("board-a");

      fireEvent.click(screen.getByLabelText("Text"));
      writeText("first");
      saveAs("first");
      writeText("second");
      saveAs("second");

      await openSaved();
      fireEvent.click(screen.getByLabelText("Forget first"));

      expect(textArea().value).toBe("second");
      expect(screen.getAllByRole("menuitem")).toHaveLength(1);
      expect(savedItem("second")).toBeTruthy();
    });

    it("forgets the last one, and the menu with it", async () => {
      renderDialog("board-a");

      saveAs("empty");
      await openSaved();
      fireEvent.click(screen.getByLabelText("Forget empty"));

      expect(screen.queryByText("Load a saved payload…")).toBeNull();
      expect(localStorage.getItem("hkp-run-payloads-board-a")).toBeNull();
    });

    it("does not offer to save a file", async () => {
      renderDialog("board-a");

      await pick(new File([new Uint8Array([1])], "x.bin"));

      expect(screen.getByText("Save").closest("button")?.disabled).toBe(true);
    });
  });
});
