# GitHub

Read content from (GitHub Source) or write content to (GitHub Sink) a GitHub repository.

---

## Available in

| Runtime | Service IDs |
|---|---|
| Browser | `hookup.to/service/github-source`, `hookup.to/service/github-sink` |

---

## GitHub Source

### What it does

Fetches content from a GitHub repository on each pipeline trigger —
files, directory listings, issues, pull requests, or raw API responses —
and emits the result downstream.

### Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `token` | `string` | `""` | GitHub Personal Access Token (PAT) or OAuth token |
| `owner` | `string` | `""` | Repository owner (user or organisation) |
| `repo` | `string` | `""` | Repository name |
| `path` | `string` | `""` | File or directory path within the repo |
| `ref` | `string` | `"main"` | Branch, tag, or commit SHA to read from |

### Input / Output

| | Shape |
|---|---|
| **Input** | Any value — used as a trigger |
| **Output** | File content (decoded from Base64), directory listing, or GitHub API response object |

---

## GitHub Sink

### What it does

Writes content to a file in a GitHub repository. Each pipeline trigger
commits the current pipeline value (or a configured payload) to the
specified path, creating or updating the file.

### Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `token` | `string` | `""` | GitHub Personal Access Token or OAuth token |
| `owner` | `string` | `""` | Repository owner |
| `repo` | `string` | `""` | Repository name |
| `path` | `string` | `""` | Target file path within the repo |
| `branch` | `string` | `"main"` | Branch to commit to |
| `message` | `string` | `"Update via hkp"` | Commit message |

### Input / Output

| | Shape |
|---|---|
| **Input** | String or JSON object — written as the file content |
| **Output** | GitHub API commit response |

---

## Typical use

### Read a config file on every board load

```
Injector (trigger) → GitHub Source → Map → configure downstream service
```

### Write board output to a repository

```
Timer → process → Map → GitHub Sink
```

Each timer tick writes the current result to a file in the repo,
creating a timestamped log.
