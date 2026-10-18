import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import AssistSettings from "./AssistSettings";
import { readAssistSettings, saveAssistSettings } from "./settings";
beforeEach(() => localStorage.clear());

function type(label: string, value: string) {
  const field = screen.getByLabelText(label);
  fireEvent.change(field, { target: { value } });
  return field;
}

it("saves a token when its field is left, outside boards, keeping other preferences", () => {
  saveAssistSettings({ model: "model-before", effort: "high" });
  render(<AssistSettings />);
  const token = type("API token", " test-anthropic ");
  expect(readAssistSettings().anthropicToken).toBe("");
  fireEvent.blur(token);
  expect(readAssistSettings()).toMatchObject({
    anthropicToken: "test-anthropic",
    effort: "high",
    model: "",
  });
  expect((token as HTMLInputElement).type).toBe("password");
});

it("shows only the chosen provider's settings and saves the choice at once", () => {
  render(<AssistSettings />);
  expect(screen.queryByLabelText("API base URL")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /OpenAI compatible/ }));
  expect(readAssistSettings().provider).toBe("openai-compatible");
  expect(screen.getByLabelText("API base URL")).toBeTruthy();
  expect(screen.getAllByLabelText("API token")).toHaveLength(1);

  fireEvent.blur(type("API base URL", "http://127.0.0.1:8081/v1"));
  fireEvent.click(screen.getByRole("button", { name: "Off" }));
  fireEvent.keyDown(type("Tokens", "16384"), { key: "Enter" });
  expect(readAssistSettings()).toMatchObject({
    openAICompatibleUrl: "http://127.0.0.1:8081/v1",
    openAIThinking: "off",
    openAIContextTokens: 16384,
  });
});

it("rejects invalid values in place without saving them", () => {
  saveAssistSettings({ provider: "openai-compatible" });
  render(<AssistSettings />);
  fireEvent.blur(type("MCP server URL", "http://user:secret@127.0.0.1:8787/mcp"));
  expect(screen.getByRole("alert").textContent).toContain("without credentials");
  expect(readAssistSettings().mcpKnowledgeUrl).toBe("");
  fireEvent.blur(type("Tokens", "1024"));
  expect(screen.getByText(/at least 4096 tokens/)).toBeTruthy();
  expect(readAssistSettings().openAIContextTokens).toBe(8192);
});

it("keeps what was typed when the dialog closes without leaving the field", () => {
  const view = render(<AssistSettings />);
  type("MCP server URL", " http://127.0.0.1:8787/mcp ");
  view.unmount();
  expect(readAssistSettings().mcpKnowledgeUrl).toBe("http://127.0.0.1:8787/mcp");
});

it("removes a saved token from its section", () => {
  saveAssistSettings({ anthropicToken: "one", model: "some-model" });
  render(<AssistSettings />);
  fireEvent.click(screen.getByRole("button", { name: "Remove Anthropic token" }));
  expect(readAssistSettings()).toMatchObject({ anthropicToken: "", model: "" });
  expect((screen.getByLabelText("API token") as HTMLInputElement).value).toBe("");
  expect(screen.queryByRole("button", { name: "Remove Anthropic token" })).toBeNull();
});

it("warns about plain HTTP endpoints on another machine without refusing them", () => {
  saveAssistSettings({ provider: "openai-compatible" });
  render(<AssistSettings />);
  type("API base URL", "http://192.168.1.20:8081/v1");
  expect(screen.getByText(/API token, your prompts/)).toBeTruthy();
  fireEvent.blur(type("MCP server URL", "http://knowledge.lan:8787/mcp"));
  expect(screen.getByText(/Search terms and boards/)).toBeTruthy();
  type("API base URL", "http://127.0.0.1:8081/v1");
  expect(screen.queryByText(/API token, your prompts/)).toBeNull();
  expect(readAssistSettings().mcpKnowledgeUrl).toBe(
    "http://knowledge.lan:8787/mcp",
  );
});
