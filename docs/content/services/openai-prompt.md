# OpenAI Prompt

Sends pipeline data to the OpenAI API and emits the model's response.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/openai-prompt` |

---

## What it does

OpenAI Prompt connects to the OpenAI API and dispatches requests based on the selected model type:

| Model type | Endpoint | Input | Output |
|---|---|---|---|
| `chat` | `/v1/chat/completions` | Text prompt + pipeline data | Assistant message string (or JSON) |
| `image` | `/v1/images/generations` | Text prompt | Image URL |
| `audio` (TTS) | `/v1/audio/speech` | Text string | Audio `Blob` |
| `text` (Whisper) | `/v1/audio/transcriptions` | Audio `Blob` | Transcription string |

The API key must be stored in the user vault under the key `openai-api-key` (read via `fromVault`).

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `model` | `string` | `"gpt-4o-mini"` | Model name |
| `prompt` | `string` | `""` | System / user prompt prepended to the pipeline value |
| `temperature` | `number` | `0` | Sampling temperature |
| `seed` | `number` | `0` | Reproducibility seed |
| `responseIsJson` | `boolean` | `false` | Parse the response as JSON before emitting |
| `voice` | `string` | `"alloy"` | TTS voice (for `tts-1` model). One of `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer` |
| `injectPrompt` | `boolean` | — | When `true`, appends the pipeline value to the configured prompt rather than replacing it |

---

## Available models

| Model | Type |
|---|---|
| `gpt-4o-mini` | chat |
| `dall-e-2` | image |
| `dall-e-3` | image |
| `tts-1` | audio |
| `whisper-1` | text |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | String (chat/image/TTS) or audio `Blob` (Whisper) |
| **Output** | String, JSON object, image URL, or audio `Blob` depending on model type |

---

## Example: summarise pipeline data

```json
{
  "model": "gpt-4o-mini",
  "prompt": "Summarise the following data in one sentence:",
  "responseIsJson": false,
  "temperature": 0.3
}
```
