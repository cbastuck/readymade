*Reads playback state and track metadata from the Spotify Web API.*

---

## Available in

| Runtime | Service ID |
|---|---|
| Browser | `hookup.to/service/spotify` |

---

## What it does

Spotify connects to the Spotify Web API using an OAuth access token and
emits the current playback state — track name, artist, album art URL,
progress, and playback status — on each pipeline trigger.

---

## Prerequisites

- A Spotify Premium account
- A valid OAuth 2.0 access token with the `user-read-playback-state`
  scope (obtained via the Spotify Authorisation Code flow or similar)

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `accessToken` | `string` | `""` | Spotify OAuth access token |
| `refreshToken` | `string` | `""` | OAuth refresh token for automatic renewal |
| `clientId` | `string` | `""` | Spotify app client ID (needed for token refresh) |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | Any value — used as a trigger; the value itself is discarded |
| **Output** | Spotify playback state object |

The output object mirrors the Spotify API's
[Get Playback State](https://developer.spotify.com/documentation/web-api/reference/get-information-about-the-users-current-playback)
response, which includes:

```json
{
  "is_playing": true,
  "progress_ms": 45000,
  "item": {
    "name": "Track Name",
    "artists": [{ "name": "Artist" }],
    "album": {
      "name": "Album",
      "images": [{ "url": "https://..." }]
    },
    "duration_ms": 240000
  }
}
```

---

## Typical use

Pair with a Timer to poll playback state periodically and display the
current track on a Canvas:

```
Timer (1s) → Spotify → Map (extract track name + art) → Canvas
```
