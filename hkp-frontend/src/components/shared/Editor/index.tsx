import {
  CSSProperties,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import "monaco-editor/esm/vs/language/json/monaco.contribution";
import "monaco-editor/esm/vs/language/typescript/monaco.contribution";

import MonacoEditor, { loader } from "@monaco-editor/react";

import { t } from "../../../styles";


// navigator.clipboard is undefined on HTTP over LAN (non-secure context).
// The browser resets Navigator.prototype during its own init, so patching in
// index.html is too early. Module-level code here runs after that setup.
// Confirmed working approach: override Navigator.prototype.clipboard getter.
if (!navigator.clipboard) {
  const _noop = (): Promise<void> => Promise.resolve();
  const _write = async (items: any[]): Promise<void> => {
    for (const item of items ?? []) {
      for (const val of Object.values(item?._data ?? {})) {
        try { await (val as Promise<any>); } catch (_) { /* Clipboard payloads can reject when unavailable. */ }
      }
    }
  };
  const _polyfill = { writeText: _noop, write: _write, readText: async () => "", read: async () => [] };
  try {
    Object.defineProperty(Navigator.prototype, "clipboard", {
      get: () => _polyfill,
      configurable: true,
    });
  } catch (_) { /* The browser may disallow replacing the clipboard getter. */ }
}

if (typeof ClipboardItem === "undefined") {
  // Store the data so our write() polyfill can consume the promises inside,
  // which lets Monaco's internal deferred promise settle and prevents the
  // CancelablePromise from staying pending (which would cause a Canceled rejection).
  (window as any).ClipboardItem = class ClipboardItem {
    _data: Record<string, unknown>;
    constructor(data: Record<string, unknown>) {
      this._data = data;
    }
  };
}

// Avoid loading monaco from CDN
// see https://github.com/suren-atoyan/monaco-react#use-monaco-editor-as-an-npm-package
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") {
      return new jsonWorker();
    }
    if (label === "typescript" || label === "javascript") {
      return new tsWorker();
    }
    return new editorWorker();
  },
};
loader.config({ monaco });

// On HTTP over LAN, navigator.clipboard is unavailable (requires secure context).
// Override Monaco's clipboard service so it never calls navigator.clipboard at all.
const isInsecureContext =
  window.location.protocol === "http:" &&
  !["localhost", "127.0.0.1"].includes(window.location.hostname);

const safeClipboardOverride = isInsecureContext
  ? {
      clipboardService: {
        writeText: async (_text: string): Promise<void> => {},
        readText: async (): Promise<string> => "",
        write: async (_data: unknown): Promise<void> => {
          console.log("WRITE");
        },
        read: async (): Promise<unknown[]> => [],
      },
    }
  : undefined;

type Props = {
  value: string;
  width?: number;
  height?: number;
  language?: string;
  style?: object;
  initialWidth?: number;
  autofocus?: boolean;
  readOnly?: boolean;
  onChange?: (updated: string | undefined) => void;
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
  onMount?: EditorMountHandler;
};

export type EditorMountHandler = (
  editor: monaco.editor.IStandaloneCodeEditor,
  monacoApi: typeof monaco,
) => void | monaco.IDisposable | (() => void);

export type EditorHandle = {
  getValue: () => any;
  setValue: (val: string) => void;
  /** Returns the currently selected text, or null if nothing is selected. */
  getSelectionText: () => string | null;
  /** Replaces the current selection with the given text. */
  replaceSelection: (text: string) => void;
};

const Editor = forwardRef<EditorHandle, Props>(function Editor(
  {
    value,
    width,
    height,
    language = "json",
    style = {},
    initialWidth = 300,
    autofocus = false,
    readOnly = false,
    onChange,
    options,
    onMount,
  }: Props,
  ref,
) {
  const editorRef = useRef<any>(null);
  const mountCleanupRef = useRef<(() => void) | null>(null);
  const onMountRef = useRef(onMount);
  onMountRef.current = onMount;
  const [editorHeight, setEditorHeight] = useState("150px");

  useEffect(
    () => () => {
      mountCleanupRef.current?.();
      mountCleanupRef.current = null;
    },
    [],
  );

  useImperativeHandle(ref, () => ({
    getValue: () => editorRef.current && editorRef.current.getValue(),
    setValue: (val: string) =>
      editorRef.current && val !== undefined && editorRef.current.setValue(val),
    getSelectionText: () => {
      const editor = editorRef.current;
      if (!editor) {
        return null;
      }
      const selection = editor.getSelection();
      if (!selection || selection.isEmpty()) {
        return null;
      }
      return editor.getModel()?.getValueInRange(selection) ?? null;
    },
    replaceSelection: (text: string) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      const selection = editor.getSelection();
      if (!selection) {
        return;
      }
      editor.executeEdits("replaceSelection", [{ range: selection, text }]);
      editor.focus();
    },
  }));

  const appliedStyle: CSSProperties = {
    border: "solid 1px lightgray",
    textAlign: "left",
    width: width || "100%",
    minWidth: initialWidth,
    height: height || editorHeight,
    ...t.selectable,
    ...style,
  };

  return (
    <div style={appliedStyle}>
      <MonacoEditor
        overrideServices={safeClipboardOverride}
        onMount={(editor) => {
          if (editor) {
            editor.updateOptions({
              wordWrap: "on",
              autoClosingBrackets: "never",
            }); // TODO: provide an option
          }
          editorRef.current = editor;
          mountCleanupRef.current?.();
          const cleanup = onMountRef.current?.(editor, monaco);
          mountCleanupRef.current =
            typeof cleanup === "function"
              ? cleanup
              : cleanup
                ? () => cleanup.dispose()
                : null;
          setTimeout(() => {
            if (autofocus) {
              editorRef.current.focus();
            }

            setEditorHeight("100%");
          });
        }}
        onChange={onChange}
        language={language}
        value={value}
        options={{ readOnly, ...options }}
      />
    </div>
  );
});

/** Own the diff widget and its models together. The React Monaco wrapper
 * disposes its models before resetting the widget, which recent Monaco builds
 * reject. Detach first, then dispose the widget and both models on close.
 */
export function DiffEditor({ original, modified, language = "json", readOnly = true, onChange }: {
  original: string;
  modified: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const diffRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const optionsRef = useRef({ readOnly, onChange });
  optionsRef.current = { readOnly, onChange };
  const syncingRef = useRef(false);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const originalModel = monaco.editor.createModel("");
    const modifiedModel = monaco.editor.createModel("");
    const diff = monaco.editor.createDiffEditor(containerRef.current, {
      readOnly: optionsRef.current.readOnly,
      originalEditable: false,
      automaticLayout: true,
      renderSideBySide: true,
      // Monaco's gutter action menu can retain stale line ranges while the
      // edited JSON shrinks. The normal change highlights remain available.
      renderGutterMenu: false,
      useInlineViewWhenSpaceIsLimited: true,
      scrollBeyondLastLine: false,
      minimap: { enabled: false },
      // A board diff needs change highlighting, not asynchronous symbol
      // occurrence searches that Monaco can report as canceled on teardown.
      occurrencesHighlight: "off",
      diffWordWrap: "on",
    }, safeClipboardOverride);
    diff.setModel({ original: originalModel, modified: modifiedModel });
    diffRef.current = diff;
    const changes = modifiedModel.onDidChangeContent(() => {
      if (!syncingRef.current) optionsRef.current.onChange?.(modifiedModel.getValue());
    });
    return () => {
      changes.dispose();
      diffRef.current = null;
      diff.setModel(null);
      diff.dispose();
      originalModel.dispose();
      modifiedModel.dispose();
    };
  }, []);

  useLayoutEffect(() => {
    const models = diffRef.current?.getModel();
    if (!models) return;
    syncingRef.current = true;
    try {
      if (models.original.getValue() !== original) models.original.setValue(original);
      if (models.modified.getValue() !== modified) models.modified.setValue(modified);
      monaco.editor.setModelLanguage(models.original, language);
      monaco.editor.setModelLanguage(models.modified, language);
    } finally {
      syncingRef.current = false;
    }
  }, [original, modified, language]);

  useLayoutEffect(() => {
    diffRef.current?.updateOptions({ readOnly, originalEditable: false });
  }, [readOnly]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%", minWidth: 0 }} />;
}

export default Editor;
