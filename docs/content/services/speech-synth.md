# Speech Synth

Speaks a text string aloud using the browser's Web Speech Synthesis API.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/speech-synth` |

---

## What it does

Speech Synth receives a text string from the pipeline and speaks it using `window.speechSynthesis`. The available voices are populated from the browser's synthesis engine and can be selected in the UI panel.

The service does not pass the text downstream — it consumes it for speech output and returns `null`.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `voices` | `SpeechSynthesisVoice[]` | `[]` | Available voices (populated by the UI from `speechSynthesis.getVoices()`) |

Voice selection is made through the UI, not programmatically through config.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | `string` — the text to speak |
| **Output** | `null` — speech output is a side effect; nothing is forwarded downstream |

Non-string inputs emit an error notification and return `null`.

---

## Browser compatibility

Speech Synthesis is available in all major browsers but voice availability and quality vary by platform and locale. On some browsers (e.g. Chrome) voices are loaded asynchronously; the service notifies the UI when the voice list is updated.
