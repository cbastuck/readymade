# Fetcher

Makes an HTTP request on each pipeline trigger and injects the response body as the next pipeline value.

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/fetcher` |

---

## What it does

Fetcher fires an HTTP request every time data arrives from upstream. The
response body becomes the new pipeline value passed downstream. It is
the pull-based counterpart to [Input](./input.md) (push-based) and
[Output](./output.md) (egress).

Use Fetcher to poll an API on each Timer tick, to load remote data when
triggered by a button press, or to chain HTTP requests with Map
transformations.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | `""` | Request URL |
| `method` | `string` | `"GET"` | HTTP method: `GET`, `POST`, `PUT`, `DELETE`, … |
| `headers` | `Record<string, string>` | `{}` | Request headers (static or dynamic with `=` suffix) |
| `body` | `string` | `""` | Request body (raw JSON string or plain text) |
| `bodyFormat` | `"json" \| "text"` | `"json"` | How `body` is parsed before sending |

### Dynamic URLs and headers

The `url` value and header values support template placeholders resolved
from the incoming pipeline data. Keys ending with `=` are evaluated as
expressions with `params` bound to the current input:

```json
{
  "url": "https://api.example.com/users/{{params.userId}}",
  "headers": {
    "Authorization=": "\"Bearer \" + params.token"
  }
}
```

### `body` and `bodyFormat`

When `bodyFormat` is `"json"`, the `body` string is parsed as JSON and
merged with the incoming pipeline params:

```json
{ "body": "{\"source\": \"hkp\"}", "bodyFormat": "json" }
```

If the incoming data is an object, it is merged: `{ "source": "hkp", ...params }`.

When `bodyFormat` is `"text"`, the body is sent as a plain string.

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value; used to compose dynamic URL / headers / body |
| **Output** | Response body — parsed as JSON if `Content-Type: application/json`, otherwise a string or Blob |

---

## Status notifications

While a request is in flight the service emits UI notifications:

- **`loading: true`** — request started
- **`done: true`** — request completed successfully
- **`error: message`** — request failed

---

## Example: polling a JSON API every second

```json
[
  {
    "serviceId": "hookup.to/service/timer",
    "state": { "periodicValue": 1, "periodicUnit": "s", "periodic": true, "running": true }
  },
  {
    "serviceId": "hookup.to/service/fetcher",
    "state": { "url": "https://api.example.com/data", "method": "GET" }
  },
  {
    "serviceId": "hookup.to/service/monitor",
    "state": {}
  }
]
```
