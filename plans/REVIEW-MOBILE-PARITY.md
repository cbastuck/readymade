# Mobile parity: review before merge

Reviewed 2026-11-07 against the `ios_feature_add` branches of the superproject,
`meander-ios` and `meander-android`, each against its `main`. The branches carry
`TODO-MOBILE-PARITY.md` M1–M6 and M8, the OpenCode Assist provider and the nesting
levels sent from a phone. This is a source review. Nothing was run on a device, and
no application code was changed.

Findings 1–3 were checked against the code a second time. The others are as the
review reported them. Line numbers refer to the `ios_feature_add` branches.

Fixes made on 2026-11-07. Fixes 1, 3 and 5 are commits on the submodule
branches. The others are in the superproject. Nothing in either has run on a
device. `meander/frontend` has no unit tests, so fixes 4, 6 and 7 are checked
only by its typecheck.

## Progress

The findings are worked through in the order of the table. This table is the only
record of where that work stands: a session picks up the first row that is not
`done`, and needs nothing but this document to do so.

| # | Finding | Blocks merge | State | Outcome, or what is pending |
| --- | --- | --- | --- | --- |
| 1 | Android serves the vault to any frame | yes | in progress | Fixed in meander-android `9736612`; the device check remains |
| 2 | Upload to cloud reads an emptied localStorage | yes | done | The upload reads the board library by default |
| 3 | iOS decodes route paths twice | yes | in progress | Fixed in meander-ios `2f2e09f`; the device check remains |
| 4 | History is keyed by name, not by library | should | in progress | iCloud boards have their own history; a check in the desktop app remains |
| 5 | Android re-pin publishes a disabled shortcut | should | in progress | Fixed in meander-android `9736612`; the device check remains |
| 6 | Deleting from the Hub leaves history and pins | should | in progress | One delete for both paths; a check in the app remains |
| 7 | The migration can duplicate a board | should | in progress | A board already moved is not saved again; a check in the app remains |
| 8 | An event fired inside a state updater | no | done | The write and the event moved out of the updater |
| 9 | OpenCode duplicates the OpenAI-compatible prompt building | no | done | Both providers call `prepareTextTurn` and `parseTextProposal` |
| 10 | A redundant vault write in the Assist token store | no | done | The backend alone keeps the page's copy |
| 11 | Android shares can copy the app's own files | yes | in progress | Only another app's content URIs are read; uncommitted in meander-android, the device check remains |
| 12 | The desktop's deletes disagree | should | in progress | The start page and Load Board delete through `deleteSavedBoard`; a check in the desktop app remains |
| 13 | Forgetting the board to continue ignores the library | no | done | `forgetLastBoard` takes the library |
| 14 | Android frames can call the native bridges | should | in progress | Every bridge call needs the page's token; uncommitted in meander-android, the device check remains |
| M1 | Submodule branches not pushed or merged | yes | open | Pointers are at the tips; the branches are unpushed, and 11 and 14 move Android's again |
| M2 | Signing and App Store validation | before shipping | open | |
| M3 | The pass on devices | before shipping | open | |

States, in order: `open`, `in progress` (what remains listed under the finding),
`done`. When a finding is done, cut its section down to what changed and the test
that pins it, and give the outcome in one line in the table.

---

## Must fix before merge

### 1. Android serves the vault to any frame

Fixed in `meander-android` `9736612`. `index.html` is served without
`Access-Control-Allow-Origin`, and the vault is written only into the page that
loads the main frame (`serveAppAsset(uri, forMainFrame)`,
`injectBridge(…, withSecrets = forMainFrame)`). A frame's request for any other
path gets the bridge without the secrets. The other assets keep the header.

Remaining: on a device, check that a cross-origin frame gets nothing (M3).

### 2. Upload to cloud reads an emptied localStorage

`useCloudBoardSources` reads the board to upload through `loadLibraryBoard`
(`core/boardLibrary`) unless the host passes a reader of its own. That is the
host's library on the phones and local storage on the web, so the web reads
what it read before. The description comes from the document wherever the host
keeps the boards. Test: `views/start/tests/cloud-board-identity.test.tsx`,
"uploads from the host's library".

### 3. iOS decodes route paths twice

Fixed in `meander-ios` `2f2e09f`. `pathName(of:)` and `pathSegments(of:)` split
`url.path(percentEncoded: true)` and decode each segment exactly once. The
home-screen, boards, history and presets routes all use them.

Remaining: on a device, unpin `Café / radio` and delete it (M3).

---

## Should fix in this PR

### 4. History is keyed by name, not by library

A board's history now belongs to a library. The history routes take
`?library=icloud`, and the desktop keeps that history in a folder of its own
(`Settings::getHistoryPath(name, iCloud)`, `<boards>/icloud-history/`). A local
board's history stays where it was, so existing history still opens, and the
history listing shows the local library's boards only. `recordSnapshot`,
`resumeBoard` and the desktop start page's Continue pass the library along.
Continue resumes from the library the board was last worked on in, and the
"recent" badge marks a saved board only when that library is the local one. The
phones have a single library and send no parameter.

Remaining: in the desktop app, edit a local `Radio` and an iCloud `Radio` one
after the other, and continue each. The backend's standalone test suite cannot
build `settings.h`, which includes hkp-rt's `auth.h`, so there is no native test.

### 5. Android re-pin publishes a disabled shortcut

Fixed in `meander-android` `9736612`. `add()` enables the shortcut before
`write()` publishes the list, and `requestOnHomeScreen` no longer does.

Remaining: pin, unpin and pin again on a device (M3).

### 6. Deleting from the Hub leaves history and pins

One delete, `deleteSavedBoard` in `meander/frontend/src/library/deleteBoard.ts`,
deletes the board and clears its history. If it is pinned, it unpins it. If it
was the board to continue, it stops offering it. The start page calls it
directly. The Hub reaches it through the platform's `deleteSavedBoard`, which
`deleteLibraryBoard` uses on the phones. Pin changes are announced
(`PINS_CHANGED`), so the start page's pin list follows an unpin made from the
Hub. `usePins` lost `unpinIfPinned`.

Remaining: in the app, delete a pinned board that is also the one to continue,
from the Hub.

### 7. The migration can duplicate a board

`migrateLocalBoards` checks every name it finds taken against the board it is
moving. If the library's board under that name is the same document (compared
with keys in order, so the store's formatting does not matter), the local
copy is only removed. That covers a board saved under its own name and one
saved as `name (2)`. A name taken by a different board still gets the next
free `name (n)`. The doc comment now says what holds.

Remaining: in the app, a migration stopped after the save. If a native store
adds fields of its own to the document, the comparison fails and the old
behaviour returns.

---

## Cleanups

### 8. An event fired inside a state updater

`addCoordinator` and `removeCoordinator` write the stored list directly. The
listener that is already there takes the new list from storage. Test:
`views/playground/mobile/tests/mobile-connections.test.tsx` (under StrictMode, an
add is announced once).

### 9. OpenCode duplicates the OpenAI-compatible prompt building

`prepareTextTurn` (budget, context without the catalog, the request, the
documentation that fits, the recent conversation) and `parseTextProposal` (the
JSON, its explanation, the proposal resolved against the scope) live in
`assist/openAICompatible.ts`. Both providers call them and differ only in
transport, in how the conversation is written (messages, or one prompt for
OpenCode), and in their error texts. Pinned by the existing
`assist/openAICompatible.test.ts` and `assist/openCode.test.ts`.

### 10. A redundant vault write in the Assist token store

The token store's `write` and `remove` no longer touch the vault. The backend's
`setSecret`, `setSecretAudience` and `deleteSecret` already keep the page's copy
in step, and the comment now says that's where it is kept.

---

## Second round

Reviewed 2026-11-07 against the branch tips above, M9 included. Compiled: the
Android Kotlin, the iOS app and share extension (typecheck), the desktop app.
Both frontends typecheck, and the hkp-frontend suite passes.

### 11. Android shares can copy the app's own files

Any app may send a share, and the shared stream is read with Readymade's own
rights. A share naming `file:///data/data/<package>/files/…` would have copied
the board library, the history or the grants into a board. `ShareInbox.streamsOf`
now keeps only content URIs of a provider that is not this app's (`isForeign`);
anything else is dropped like an unreadable stream.

Remaining: on a device, a share from the Photos app and from Files still arrives.

### 12. The desktop's deletes disagree

The Hub deleted through `deleteSavedBoard`, while the desktop start page and the
Load Board dialog deleted the board alone, so Continue could bring a deleted
board back from its history. Both now call `deleteSavedBoard` (the dialog
through `actions.deleteBoard`), and the start page reads the board to continue
again afterwards.

Remaining: in the desktop app, delete the board offered to continue from the
start page and from Load Board.

### 13. Forgetting the board to continue ignores the library

`forgetLastBoard(name, library)` forgets only when the board last worked on is
that library's, so deleting a local `Radio` keeps an iCloud `Radio` offered.

### 14. Android frames can call the native bridges

`addJavascriptInterface` puts `AndroidHkpBridge` and the two auth bridges into
every frame, so a cross-origin frame could read and write boards, settings and
pins, or start a login. Every bridge method now takes a token first
(`BridgeToken`, drawn once per process), which `bridgeScript` writes only into
the top-level page, inside the script's closure. A frame's shims pass an empty
token, and the bridges refuse it. No frame of the app's own pages uses the
bridges.

Remaining: on a device, a cross-origin frame's `AndroidHkpBridge.fetch` is
refused, and the app (boards, login, the embedded runtime's login users) works
as before.

---

## Outside the code

### M1. Submodule branches not pushed or merged

The superproject's `ios_feature_add` points at the submodule branch tips
(`5e0f15f`, `e50e351`), but none of the three branches is pushed past
`origin/ios_feature_add`. Fixes 11 and 14 add a commit to meander-android, so
its pointer moves again. Push all three, merge the two submodule PRs first, by
merge commit or fast-forward (a squash or rebase leaves the pointers naming
commits no branch holds), then merge the superproject.

### M2. Signing and App Store validation

- The widget's provisioning profile needs the App Group, as the share extension's
  does.
- The app identifier needs the iCloud capability and the container
  `iCloud.com.readymadeit.readymade`.
- Raise the build number, or a device that already has the app keeps the old
  container settings.
- Check that App Store validation accepts a widget extension with a higher minimum
  iOS (17) than the app (16).

### M3. The pass on devices

Nothing on these branches has run on a device. Each milestone's "Still open" in
`TODO-MOBILE-PARITY.md` lists its pass. Once 1–3 are fixed the branches can be
merged without it, but it comes before shipping. These matter most, and findings
1, 3 and 5 belong in it:

- Pin → widget, quick action, Shortcuts icon and Siri, from a cold start and with
  the app running; Android's pin dialog, a placed icon, unpin and pin again.
- iCloud: the container in Files, a board round-trip between phone and Mac, iCloud
  Drive off and on, the migration with real localStorage boards.
- Secrets: the token check against a real WebKit preflight, a reload after iOS
  reclaims the content process, and a cross-origin frame on Android getting
  nothing.
- Assist: the keyboard over the sticky composer, streaming from a real provider.
