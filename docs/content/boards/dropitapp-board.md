# DropApp

AirDrop, built out of parts: pick an image on a phone, chunk it, upload it to a
runtime on your own machine, and hand the phone its interface as a QR code.

## What it does

It shows a QR code. Scan it with a phone and you get a picker; choose an image
and it lands in `/tmp/dropitapp` on the machine running the server runtime.

## How it works

Two runtimes: a browser one that builds and serves the phone's interface, and a
REST one that receives the file.

### UI — the browser

1. **Phone Board**, a [Sub-Service](../services/sub-service.md) in `source`
   mode, *contains a whole second board* called **AirDrop Phone** — an
   [Image Picker](../services/image-picker.md), a
   [Chunked File Provider](../services/chunked-file-provider.md) and an
   [HTTP Uploader](../services/http-uploader.md) pointed at
   `HKP_RUNTIME_URL/runtimes/upload-server`. That inner board never runs here;
   it is cargo.
2. **HTTP Uploader Token Injector** puts the credential the upload will need
   into that inner board — at hand-out time, so the token is not sitting in the
   saved document.
3. [LZ Compress](../services/lz-compress.md) compresses the inner board.
4. **URL Builder**, a [Map](../services/map.md), wraps it in a playground URL.
5. [QR Code](../services/qr-code.md) renders that URL.

### Upload Server — a REST runtime

A single [Filesystem](../services/filesystem.md) service in `write` mode,
writing to `/tmp/dropitapp`.

## Why the phone's board is cargo

The phone is not running an app you installed; it is running a board that this
board handed it, encoded in the QR code it scanned. The interesting consequence
is that changing what the phone does means editing the sub-service's pipeline
and re-showing the code — there is nothing to deploy, and nothing on the phone
to update.

The chunking matters too: [Chunked File Provider](../services/chunked-file-provider.md)
breaks the image into pieces so a large photo uploads as a sequence rather than
one request that may not survive a phone's connection.

## Try it

It needs a runtime reachable as `hkp://remotes/meander-cpp` with write access to
`/tmp/dropitapp`, and the phone must be able to reach that runtime's URL.
