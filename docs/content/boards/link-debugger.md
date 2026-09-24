# Link Debugger

Three services that turn a shared board link back into the board it encodes. A
tool for working on Readymade rather than an app built with it.

## What it does

Paste a compressed `?fromLink=…` payload and read the board JSON it contains.

## How it works

One [browser runtime](../concepts/runtime.md).

1. **Compressed Link**, an [Injector](../services/injector.md) in plain-text
   mode, is where you paste the string.
2. **Decompress**, an [LZ Compress](../services/lz-compress.md) in `decompress`
   mode, expands it.
3. **Board JSON**, a [Monitor](../services/monitor.md), shows the result.

## Why it exists

A board travels as a link: the whole document, LZ-compressed into a URL
parameter. That is what every *Open in Playground* button on these pages
produces, and what a QR code shared from the app encodes. When one of those
links does not load, the question is always whether the payload is wrong or the
loading is — and this board answers it by showing you exactly what the link
says.

It is also the shortest demonstration that a board can be a developer tool. The
same three services in the other direction would make links instead of reading
them.
