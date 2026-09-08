# Document Extract

Turns a document into text a model can read — and says how well it went.

---

## Available in

| Runtime | Service ID |
|---|---|
| Node.js (hkp-node) | `document-extract` |

---

## What it does

Document Extract takes bytes and produces text. The natural producer is
anything that yields bytes — `http-client`, an email attachment, a `file-pick`
widget — and the natural consumer is `text-generation`.

Alongside the text it reports **how much there was to find**, which is the more
interesting half. A PDF with a text layer gives thousands of characters a page;
a scan of the same document gives almost none. That difference is reported as
`sparse`, and a board branches on it.

### OCR runs when it is needed

A scanned page is read by an OCR engine **in this process** — no network, no
per-page charge — so it happens by default. Leaving it off would hand back an
empty document rather than save anything.

| `ocr` | What gets read |
|---|---|
| `"auto"` (default) | Images always; a scanned PDF page by page; a PDF that already has a text layer, not at all |
| `"off"` | Text layers only. A scan comes back empty |
| `"force"` | Every page, even where a text layer exists — what a *bad* text layer needs, such as a scan wrapped in a PDF by an office suite |

What stays off is the **paid** tier: a vision model reading pages an OCR engine
could not. That one costs per page, so it is a board's decision. `sparse` is the
signal to make it on:

```
document-extract  →  switch (sparse)  →  ┬ false: text-generation
                                         └ true:  a vision model, or a person
```

With OCR on, `sparse` means a local engine could not read the pages either —
which is a much stronger signal than "this PDF has no text layer".

---

## Backends

| `backend` | Reads | Needs |
|---|---|---|
| `xberg` (default) | PDF, DOCX, XLSX, PPTX, archives, email, images, and ~100 more — with page counts, tables, OCR, and a confidence model | `npm install @xberg-io/xberg` |
| `builtin` | Text, HTML, JSON, CSV, Markdown | nothing |

**`@xberg-io/xberg` is not a dependency of hkp-node.** Its platform binaries run
to about 150 MB each and most boards never read a document, so it is installed
separately and reported as missing rather than assumed:

```
npm install @xberg-io/xberg
```

It is MIT-licensed, ships prebuilt binaries for six platforms (no Rust
toolchain at install time), has no runtime dependencies of its own, and needs
Node 22 or newer.

### Picking an OCR engine

`ocrBackend` selects one; left empty, the library picks. They differ in what
they need on the machine:

| Engine | Needs |
|---|---|
| `paddleocr`, `sceptre`, and the `candle-*` family | Nothing to install — model weights download from Hugging Face on first use and are cached |
| `tesseract` | **A system install.** `brew install tesseract` / `apt-get install tesseract-ocr`, plus a language pack per language |

The first document through a downloading engine pays for the download, which on
a deployed board looks like one very slow request. Warm it with a document
before anyone depends on the timing.

`ocrLanguage` takes `"deu"`, `"deu,eng"`, or `["deu", "eng"]`.

The `builtin` backend needs nothing and reads what `http-client` typically
brings back. Asked for a PDF it says so and stops — decoding one as UTF-8 would
look like a successful extraction of gibberish, which is worse than an error.

The `backend` field exists from the first version because the library is young.
Swapping it must not mean touching a board.

---

## Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `backend` | `string` | `"xberg"` | `xberg` or `builtin` |
| `ocr` | `string` | `"auto"` | `auto`, `off`, or `force` — see above. `true`/`false` are read as `auto`/`off` |
| `ocrBackend` | `string` | `""` | OCR engine (`paddleocr`, `tesseract`, `sceptre`, …). Empty lets the library pick |
| `ocrLanguage` | `string\|string[]` | `[]` | `"deu"`, `"deu,eng"`, or `["deu","eng"]`. Empty uses the library's default |
| `tables` | `bool` | `false` | Include extracted tables in the output |
| `metadata` | `bool` | `false` | Include document metadata (author, title, dates) |
| `maxChars` | `number` | `0` | Cap the text handed on; `0` = no cap. Sets `truncated` when it bites |
| `minCharsPerPage` | `number` | `100` | Below this, a page counts as having no text |
| `minTextCoverage` | `number` | `0.6` | Below this fraction of pages carrying text, the document is sparse |

---

## Input / Output

| | Shape |
|---|---|
| **Input** | `{ meta: { contentType, filename }, binary }` (what `http-client` produces), a `Uint8Array`, `{ meta, body }`, or a `String` |
| **Output** | `{ text, chars, pages, charsPerPage, sparse, method, format, backend, durationMs, truncated?, textCoverage?, confidence?, metadata?, tables? }` |

| Field | Means |
|---|---|
| `sparse` | **The one to branch on.** Too little text came back to trust, whatever was tried to get it |
| `chars` | Characters found, before any `maxChars` cap |
| `charsPerPage` | Density. A page-less document counts as one page |
| `textCoverage` | Fraction of pages with a usable text layer (`xberg` only) |
| `confidence` | The backend's own combined score, `0`–`1` (`xberg` only) |
| `method` | `native`, `ocr`, or `mixed` |

`sparse` prefers `textCoverage` where the backend reports it: density can only
infer which pages produced text, while the backend knows. A document dense on
two pages out of twenty is still mostly unreadable, and only coverage sees that.

It reads bytes, not URLs. A document behind a link is `http-client`'s job —
which keeps fetching, with everything that implies about what a server may be
asked to reach, in the service that already answers for it.

**The text is pushed, not returned.** Extraction takes long enough to matter and
the pipeline does not wait, so the service returns nothing, stops the push, and
calls the rest of the pipeline itself once the text exists (the same
inversion-of-control path `http-client` takes).

Anything that goes wrong — an encrypted PDF, a missing backend, an empty
document — is reported as `{ error }` and passes nothing on. A board that
carried on here would summarise an empty string as though the document had said
nothing.

---

## Status notifications

| `status` | Meaning |
|---|---|
| `idle` | Ready; last document finished |
| `extracting` | Reading in progress |
| `error` | Something failed (input, backend, or document) |

---

## Example

The attached demo board reads a document and extracts structured fields from
it: `http-client` fetches → `document-extract` reads → `text-generation` with a
`jsonSchema` turns it into fields → `monitor` shows them.

```json
{
  "node": [
    { "serviceId": "http-client", "state": { "url": "https://example.com/offer.pdf" } },
    { "serviceId": "document-extract", "state": { "backend": "xberg" } },
    { "serviceId": "text-generation", "state": { "jsonSchema": { "type": "object" } } },
    { "serviceId": "monitor" }
  ]
}
```
