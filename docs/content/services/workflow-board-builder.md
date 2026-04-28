# Workflow Board Builder

Generates a complete HKP board JSON from a natural language description using an AI model.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/workflow-board-builder` |

---

## What it does

Workflow Board Builder sends a natural language workflow description to a large language model (Claude, OpenAI, or Gemini) and asks it to produce a valid HKP board JSON. The generated board is displayed in an embedded editor where it can be reviewed, edited, and loaded into the runtime.

The prompt sent to the model includes a detailed system prompt that describes the board JSON schema, the available services and their configuration, and example boards.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `provider` | `"claude"` \| `"openai"` \| `"gemini"` | `"claude"` | AI provider to use |
| `model` | `string` | Provider-specific default | Model name (e.g. `"claude-3-7-sonnet-latest"`, `"gpt-4.1-mini"`, `"gemini-2.0-flash"`) |
| `description` | `string` | Example description | Natural language description of the desired board |
| `inputBoardSource` | `string` | `""` | Optional existing board JSON to refine or extend |
| `generatedBoardSource` | `string` | Default board | The generated board JSON (editable in the UI) |

### Default models per provider

| Provider | Default model |
|---|---|
| `claude` | `claude-3-7-sonnet-latest` |
| `openai` | `gpt-4.1-mini` |
| `gemini` | `gemini-2.0-flash` |

### API keys

API keys are read from the user vault:
- Claude: `claude-api-key`
- OpenAI: `openai-api-key`
- Gemini: `gemini-api-key`

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Ignored (generation is triggered through the UI) |
| **Output** | None — the generated board is loaded via the UI |

---

## How it works

1. The user writes a description in the UI (e.g. "Fetch the top Hacker News stories every minute and display them").
2. Clicking **Generate** sends the description + an optional input board to the model with the HKP system prompt.
3. The model returns a board JSON.
4. The JSON is shown in the embedded Monaco editor.
5. The user clicks **Load Board** to apply it to the runtime.
