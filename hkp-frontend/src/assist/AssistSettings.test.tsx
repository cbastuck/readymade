import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import AssistSettings from "./AssistSettings";
import { readAssistSettings, saveAssistSettings } from "./settings";
beforeEach(() => localStorage.clear());
it("saves provider tokens outside boards and preserves unrelated preferences", () => {
  saveAssistSettings({ model: "model-before", effort: "high" });
  render(<AssistSettings />);
  const fields = screen.getAllByLabelText("API token");
  fireEvent.change(fields[0], { target: { value: " test-anthropic " } });
  fireEvent.change(fields[1], { target: { value: " test-compatible " } });
  fireEvent.change(screen.getByLabelText("MCP server URL"), {
    target: { value: " http://127.0.0.1:8787/mcp " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(readAssistSettings()).toMatchObject({
    anthropicToken: "test-anthropic",
    openAICompatibleToken: "test-compatible",
    mcpKnowledgeUrl: "http://127.0.0.1:8787/mcp",
    effort: "high",
    model: "",
  });
  expect(screen.getByRole("status").textContent).toContain("Saved");
  expect((fields[0] as HTMLInputElement).type).toBe("password");
});
it("rejects unsafe MCP endpoint forms", () => {
  render(<AssistSettings />);
  fireEvent.change(screen.getByLabelText("MCP server URL"), {
    target: { value: "http://user:secret@127.0.0.1:8787/mcp" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByRole("status").textContent).toContain(
    "without credentials",
  );
  expect(readAssistSettings().mcpKnowledgeUrl).toBe("");
});
it("removes both saved tokens", () => {
  saveAssistSettings({
    anthropicToken: "one",
    openAICompatibleToken: "two",
    model: "some-model",
  });
  render(<AssistSettings />);
  fireEvent.click(screen.getByRole("button", { name: "Remove tokens" }));
  expect(readAssistSettings()).toMatchObject({
    anthropicToken: "",
    openAICompatibleToken: "",
    model: "",
  });
});
