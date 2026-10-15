import { StrictMode } from "react";
import { render } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  createModel: vi.fn(),
  createDiffEditor: vi.fn(),
  setModelLanguage: vi.fn(),
  attached: new Set<unknown>(),
}));
vi.mock("monaco-editor/esm/vs/editor/editor.api", () => ({ editor: api }));
vi.mock("monaco-editor/esm/vs/editor/editor.worker?worker", () => ({
  default: class {},
}));
vi.mock("monaco-editor/esm/vs/language/json/json.worker?worker", () => ({
  default: class {},
}));
vi.mock("monaco-editor/esm/vs/language/typescript/ts.worker?worker", () => ({
  default: class {},
}));
vi.mock("monaco-editor/esm/vs/language/json/monaco.contribution", () => ({}));
vi.mock(
  "monaco-editor/esm/vs/language/typescript/monaco.contribution",
  () => ({}),
);
import { DiffEditor } from "./index";
beforeEach(() => {
  api.attached.clear();
  api.createModel.mockImplementation(() => {
    let value = "";
    const listeners = new Set<() => void>();
    const model = {
      getValue: () => value,
      setValue: vi.fn((next: string) => {
        value = next;
        listeners.forEach((listener) => listener());
      }),
      onDidChangeContent: vi.fn((listener: () => void) => {
        listeners.add(listener);
        return { dispose: vi.fn(() => listeners.delete(listener)) };
      }),
      dispose: vi.fn(() => {
        if (api.attached.has(model))
          throw new Error(
            "TextModel got disposed before DiffEditorWidget model got reset",
          );
      }),
    };
    return model;
  });
  api.createDiffEditor.mockImplementation(() => {
    let models: { original: unknown; modified: unknown } | null = null;
    return {
      getModel: () => models,
      updateOptions: vi.fn(),
      setModel: vi.fn((next: typeof models) => {
        if (models) {
          api.attached.delete(models.original);
          api.attached.delete(models.modified);
        }
        models = next;
        if (models) {
          api.attached.add(models.original);
          api.attached.add(models.modified);
        }
      }),
      dispose: vi.fn(() => {
        if (models) throw new Error("Diff editor was not detached");
      }),
    };
  });
});
it("closes without disposing attached models and releases every resource", () => {
  const view = render(<DiffEditor original="before" modified="after" />);
  const [original, modified] = api.createModel.mock.results.map(
    (result) => result.value,
  );
  expect(original.getValue()).toBe("before");
  expect(modified.getValue()).toBe("after");
  expect(api.createDiffEditor.mock.calls[0][1]).toMatchObject({
    readOnly: true,
    originalEditable: false,
  });
  expect(() => view.unmount()).not.toThrow();
  expect(api.attached.size).toBe(0);
  expect(original.dispose).toHaveBeenCalledTimes(1);
  expect(modified.dispose).toHaveBeenCalledTimes(1);
  expect(
    api.createDiffEditor.mock.results[0].value.dispose,
  ).toHaveBeenCalledTimes(1);
});
it("updates the diff without replacing its models", () => {
  const view = render(<DiffEditor original="one" modified="two" />);
  view.rerender(
    <DiffEditor original="three" modified="four" language="text" />,
  );
  expect(api.createDiffEditor).toHaveBeenCalledTimes(1);
  expect(api.createModel).toHaveBeenCalledTimes(2);
  expect(
    api.createModel.mock.results.map((result) => result.value.getValue()),
  ).toEqual(["three", "four"]);
  view.unmount();
});
it("survives Strict Mode and repeated open/close cycles without leaking models", () => {
  for (let cycle = 0; cycle < 3; cycle++) {
    const view = render(
      <StrictMode>
        <DiffEditor original="one" modified="two" />
      </StrictMode>,
    );
    expect(() => view.unmount()).not.toThrow();
  }
  expect(api.attached.size).toBe(0);
  for (const result of api.createModel.mock.results)
    expect(result.value.dispose).toHaveBeenCalledTimes(1);
  for (const result of api.createDiffEditor.mock.results)
    expect(result.value.dispose).toHaveBeenCalledTimes(1);
});

it("reports edits only from the proposed side and releases its change listener", () => {
  const onChange = vi.fn();
  const view = render(
    <DiffEditor
      original="one"
      modified="two"
      readOnly={false}
      onChange={onChange}
    />,
  );
  const original = api.createModel.mock.results[0].value;
  const modified = api.createModel.mock.results[1].value;
  expect(onChange).not.toHaveBeenCalled();
  modified.setValue("manual edit");
  expect(onChange).toHaveBeenLastCalledWith("manual edit");
  original.setValue("left update");
  expect(onChange).toHaveBeenCalledTimes(1);
  view.rerender(
    <DiffEditor
      original="one"
      modified="manual edit"
      readOnly
      onChange={onChange}
    />,
  );
  expect(
    api.createDiffEditor.mock.results[0].value.updateOptions,
  ).toHaveBeenLastCalledWith({ readOnly: true, originalEditable: false });
  view.unmount();
  expect(
    modified.onDidChangeContent.mock.results[0].value.dispose,
  ).toHaveBeenCalledTimes(1);
});
