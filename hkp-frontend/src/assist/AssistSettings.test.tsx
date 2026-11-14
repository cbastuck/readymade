import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mcp = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock("./mcpKnowledge", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  checkMcpKnowledgeServer: mcp.check,
}));
import AssistSettings from "./AssistSettings";
import {
  DEFAULT_MCP_KNOWLEDGE_URL,
  readAssistSettings,
  saveAssistSettings,
  setAssistTokenStore,
} from "./settings";
beforeEach(() => localStorage.clear());
afterEach(() => setAssistTokenStore(null));

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
  fireEvent.change(screen.getByLabelText("Provider"), {
    target: { value: "openai-compatible" },
  });
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

it("configures Mistral with a key alone and can remove it", () => {
  render(<AssistSettings />);
  fireEvent.change(screen.getByLabelText("Provider"), {
    target: { value: "mistral" },
  });
  expect(readAssistSettings().provider).toBe("mistral");
  expect(screen.queryByLabelText("API base URL")).toBeNull();
  const key = type("API key", " mistral-key ");
  expect((key as HTMLInputElement).type).toBe("password");
  fireEvent.blur(key);
  expect(readAssistSettings()).toMatchObject({
    mistralToken: "mistral-key",
    model: "",
  });
  fireEvent.click(screen.getByRole("button", { name: "Remove Mistral key" }));
  expect(readAssistSettings().mistralToken).toBe("");
});

it("configures an OpenCode server and shows its current CORS origin", () => {
  render(<AssistSettings />);
  fireEvent.change(screen.getByLabelText("Provider"), {
    target: { value: "opencode" },
  });
  expect(readAssistSettings().provider).toBe("opencode");
  expect(screen.getByLabelText("Server URL")).toBeTruthy();
  expect(screen.getByLabelText("Server username")).toBeTruthy();
  expect(screen.getByLabelText("Server password")).toBeTruthy();
  expect(screen.getByText(/opencode serve --cors/).textContent).toContain(
    window.location.origin,
  );
  fireEvent.blur(type("Server URL", "http://127.0.0.1:4096"));
  fireEvent.blur(type("Server password", " server-password "));
  expect(readAssistSettings()).toMatchObject({
    openCodeUrl: "http://127.0.0.1:4096",
    openCodePassword: "server-password",
  });
});

it("configures OpenCode Go with a key and a relay, and says why a relay", () => {
  render(<AssistSettings />);
  fireEvent.change(screen.getByLabelText("Provider"), {
    target: { value: "opencode-go" },
  });
  expect(readAssistSettings().provider).toBe("opencode-go");
  expect((screen.getByLabelText("API base URL") as HTMLInputElement).value).toBe(
    "https://opencode.ai/zen/go/v1",
  );
  expect(screen.getByText(/does not yet answer/).textContent).toContain(
    "X-Opencode-Session",
  );
  fireEvent.blur(type("API key", " go-key "));
  fireEvent.blur(type("API base URL", "https://example.com/opencode.php/go/v1"));
  fireEvent.blur(type("Relay key", "relay-secret"));
  expect(readAssistSettings()).toMatchObject({
    openCodeGoToken: "go-key",
    openCodeGoUrl: "https://example.com/opencode.php/go/v1",
    openCodeGoRelayKey: "relay-secret",
  });
  expect((screen.getByLabelText("Relay key") as HTMLInputElement).type).toBe(
    "password",
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove OpenCode Go key" }));
  expect(readAssistSettings().openCodeGoToken).toBe("");
});

it("keeps a focused OpenCode password when the page reloads", () => {
  const view = render(<AssistSettings />);
  fireEvent.change(screen.getByLabelText("Provider"), {
    target: { value: "opencode" },
  });
  type("Server password", "server-password");
  fireEvent(window, new Event("pagehide"));
  expect(readAssistSettings().openCodePassword).toBe("server-password");
  view.unmount();
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

it("says tokens are kept with the device's secrets where the host has them, and when one was refused", async () => {
  setAssistTokenStore({
    read: () => null,
    write: async () => {
      throw new Error("refused");
    },
    remove: async () => {},
    setAudience: async () => {},
  });
  render(<AssistSettings />);
  expect(screen.getByText("readymade.assist.anthropic")).toBeTruthy();
  fireEvent.blur(type("API token", "sk-ant"));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Could not save on this device.",
  );
});

it("configures OpenAI with only a key, and keeps it to OpenAI's host", async () => {
  const writes: { alias: string; audience: string[] }[] = [];
  setAssistTokenStore({
    read: () => null,
    write: async (alias, _value, audience) => {
      writes.push({ alias, audience });
    },
    remove: async () => {},
    setAudience: async () => {},
  });
  render(<AssistSettings />);
  fireEvent.change(screen.getByLabelText("Provider"), {
    target: { value: "openai" },
  });
  expect(readAssistSettings().provider).toBe("openai");
  expect(screen.queryByLabelText("API base URL")).toBeNull();
  fireEvent.blur(type("API key", " sk-test "));
  expect(writes).toEqual([
    { alias: "readymade.assist.openai", audience: ["api.openai.com"] },
  ]);
});

it("checks the knowledge server only when asked, and shows how it went", async () => {
  let answer!: (value: { tools: number }) => void;
  mcp.check.mockReset();
  mcp.check.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
  render(<AssistSettings />);
  const check = screen.getByRole("button", { name: "Check" });
  type("MCP server URL", "http://127.0.0.1:8787/mcp");
  expect(mcp.check).not.toHaveBeenCalled();
  expect(screen.queryByRole("status")).toBeNull();

  fireEvent.click(check);
  expect(mcp.check).toHaveBeenCalledTimes(1);
  expect(mcp.check.mock.calls[0][0]).toBe("http://127.0.0.1:8787/mcp");
  expect(screen.getByRole("status").dataset.state).toBe("pending");
  expect((check as HTMLButtonElement).disabled).toBe(true);
  await act(async () => answer({ tools: 7 }));
  expect(screen.getByRole("status").dataset.state).toBe("ok");
  expect(readAssistSettings().mcpKnowledgeUrl).toBe("http://127.0.0.1:8787/mcp");

  mcp.check.mockRejectedValueOnce(new Error("fetch failed"));
  await act(async () => fireEvent.click(check));
  expect(screen.getByRole("status").dataset.state).toBe("failed");
  expect(screen.getByText(/fetch failed/)).toBeTruthy();

  // Another address has not been checked.
  type("MCP server URL", "http://127.0.0.1:9999/mcp");
  expect(screen.queryByRole("status")).toBeNull();
  expect(mcp.check).toHaveBeenCalledTimes(2);
});

it("checks the hosted knowledge server while no URL is set", async () => {
  mcp.check.mockReset();
  mcp.check.mockResolvedValueOnce({ tools: 7 });
  render(<AssistSettings />);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Check" })),
  );
  expect(mcp.check.mock.calls[0][0]).toBe(DEFAULT_MCP_KNOWLEDGE_URL);
  expect(screen.getByRole("status").dataset.state).toBe("ok");
  expect(readAssistSettings().mcpKnowledgeUrl).toBe("");
});
