# Match Filter

Drops string values that contain any of the configured filter terms, passing all others through.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/match-filter` |

---

## What it does

Match Filter checks whether the incoming string contains any of the strings in `filterByTerms` (substring match). If a match is found, the value is suppressed (returns `null`). If no match is found, the value is forwarded unchanged.

Use Match Filter as a content blocker — for example, to suppress log lines containing specific keywords, or to filter chat messages that include banned phrases.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `filterByTerms` | `string[]` | `undefined` | List of substrings to block. Any input containing one of these strings is dropped. |

If `filterByTerms` is not set, all values pass through.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value — matched using `String.indexOf` |
| **Output** | The original input if no filter term matches; `null` if any term matches |
