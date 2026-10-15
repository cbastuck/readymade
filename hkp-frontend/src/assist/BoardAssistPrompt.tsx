import { useRef } from "react";
import Editor, { EditorMountHandler } from "../components/shared/Editor";
import {
  AssistPromptContext,
  buildAssistPromptCompletions,
  promptMentionStart,
} from "./promptCompletions";

type Props = {
  board: AssistPromptContext | null;
  value: string;
  disabled: boolean;
  height?: number;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export default function BoardAssistPrompt({
  board,
  value,
  disabled,
  height = 112,
  onChange,
  onSubmit,
}: Props) {
  const boardRef = useRef(board);
  const submitRef = useRef(onSubmit);
  boardRef.current = board;
  submitRef.current = onSubmit;

  const mount: EditorMountHandler = (editor, monaco) => {
    const model = editor.getModel();
    const completionProvider = monaco.languages.registerCompletionItemProvider(
      "plaintext",
      {
        triggerCharacters: ["@"],
        provideCompletionItems: (candidateModel, position, context) => {
          if (candidateModel !== model) return { suggestions: [] };
          const beforeCaret = candidateModel
            .getLineContent(position.lineNumber)
            .slice(0, position.column - 1);
          const mentionStart = promptMentionStart(beforeCaret);
          if (
            mentionStart === null &&
            context.triggerKind !==
              monaco.languages.CompletionTriggerKind.Invoke
          )
            return { suggestions: [] };

          const startColumn =
            mentionStart === null ? position.column : mentionStart + 1;
          const range = new monaco.Range(
            position.lineNumber,
            startColumn,
            position.lineNumber,
            position.column,
          );
          const suggestions = buildAssistPromptCompletions(
            boardRef.current,
          ).map((item) => ({
            label: item.label,
            detail: item.detail,
            filterText: item.filterText,
            insertText: item.insertText,
            sortText: item.sortText,
            range,
            kind:
              item.category === "runtime" || item.category === "runtime-type"
                ? monaco.languages.CompletionItemKind.Module
                : monaco.languages.CompletionItemKind.Function,
          }));
          return { suggestions };
        },
      },
    );
    const submitAction = editor.addAction({
      id: "board-assist-submit",
      label: "Send to Board Assist",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => submitRef.current(),
    });
    return () => {
      completionProvider.dispose();
      submitAction.dispose();
    };
  };

  return (
    <div className="hkp-assist-prompt-editor">
      <Editor
        value={value}
        language="plaintext"
        height={height}
        initialWidth={0}
        readOnly={disabled}
        style={{
          border: "1px solid var(--border-mid, #d1d5db)",
          borderRadius: 6,
          marginBottom: 8,
          overflow: "hidden",
        }}
        onChange={(updated) => onChange(updated ?? "")}
        onMount={mount}
        options={{
          ariaLabel: "Message to Board Assist",
          placeholder:
            "What would you like to build or change? \n \nType @ to reference the board.",
          automaticLayout: true,
          contextmenu: false,
          fixedOverflowWidgets: true,
          folding: false,
          glyphMargin: false,
          lineDecorationsWidth: 8,
          lineNumbers: "off",
          lineNumbersMinChars: 0,
          minimap: { enabled: false },
          overviewRulerLanes: 0,
          padding: { top: 8, bottom: 8 },
          quickSuggestions: false,
          renderLineHighlight: "none",
          scrollBeyondLastLine: false,
          scrollbar: {
            horizontal: "hidden",
            horizontalScrollbarSize: 0,
            verticalScrollbarSize: 6,
          },
          suggestOnTriggerCharacters: true,
          wordWrap: "on",
        }}
      />
    </div>
  );
}
