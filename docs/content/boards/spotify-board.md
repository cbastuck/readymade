# Spotify to GitHub

Reads what you are listening to and commits it to a Git repository — then reads
it back from a second runtime. Two chains that never talk to each other, joined
only by the file one writes and the other reads.

## What it does

The first runtime polls Spotify for the current track and appends it to a file
in a GitHub repo. The second runtime reads that file back. The result is a
listening history you own, in a repository you control.

## How it works

Two [browser runtimes](../concepts/runtime.md), and this is the point of the
board: they are **separate chains in one document**, not a pipeline split in
two. The collector writes; the reader reads; neither knows the other exists.

**Collector**

1. [Spotify](../services/spotify.md) fetches the currently playing track.
2. **Map Track**, a [Map](../services/map.md), reduces it to the fields worth
   keeping.
3. [Monitor](../services/monitor.md) shows what is about to be written.
4. [GitHub Sink](../services/github.md) commits it to `owner/repo` on the
   configured branch.

**Reader**

1. [GitHub Source](../services/github.md) fetches the file back.
2. [Monitor](../services/monitor.md) shows it.

## Why two runtimes

They could have been one chain. Keeping them apart means each can be run on its
own — collect without reading, read without collecting — and the storage between
them is a Git repository rather than anything this board holds. GitHub is being
used here as the database, with version history as a free side effect.

## Try it

Both halves need configuring before anything happens: a Spotify token on the
Spotify service, and a GitHub token plus `owner`, `repo` and `branch` on both
GitHub services. Nothing is stored in the board — see
[secrets](../concepts/board.md) for why credentials are kept out of the
document.
