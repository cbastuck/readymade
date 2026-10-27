# Mobile parity: bringing the desktop features to iOS and Android

Started 2026-10-26. A great deal of UI has landed on the web and desktop since the
mobile views were last brought level. This plan collects what is missing on iOS
and Android, which of it belongs on a phone, and how each piece gets there.

Ticked boxes are done. When a milestone lands, its conclusions move into the docs
(`docs/content/targets.md` first of all), and once nothing here is open the plan
is deleted.

---

## What mobile is for

**A phone builds small and mid-sized boards, and monitors and observes bigger
boards and deployments.** That decides most questions below. Building needs
presets, blocks and Run. Observing needs the flow inspector, Capture mode and the
overview. A phone is not where a facade is designed.

## How features get there

The mobile UI stays a **separate component tree**: `views/playground/mobile`,
`views/start/mobile`, `views/cloud/mobile` and `meander/frontend/src/MobileApp.tsx`.
It is not made into a responsive version of the desktop components.

That is cheaper than it sounds, because nearly everything missing is desktop UI
over logic that already lives in shared modules: `core/blockActions`,
`core/wrapActions`, `core/presets`, `core/play`, `core/runPayloads`,
`core/deployPreflight`, `core/boardSnapshots`, `runtime/captureMode`, `assist/*`.
Porting a feature means a bottom sheet or a full-screen page in the mobile style
(`views/playground/mobile/tokens.ts`, `BottomSheet.tsx`) calling those modules.
**A port that needs to change shared logic is a sign the logic is in the wrong
place.** Move it into `core/` first, and keep desktop behaviour unchanged.

Both shells reach the app through `hkp://` routes. A capability that needs the
machine (storage, secrets, pinning) is a route or an injected value on **both**
`meander-ios` (Swift) and `meander-android` (Kotlin), so the web app has one
calling convention.

---

## Progress

| # | Milestone | State |
|---|---|---|
| M1 | Pin a board to the Home Screen | built 2026-10-26; the pass on devices open |
| M2 | Boards in native storage, history and resume | built 2026-10-26; the iCloud pass on devices open |
| M3 | Building: presets, blocks, Run and Run with… | built 2026-10-27; multi-pipeline services and the pass on devices open |
| M4 | Observing: flow inspector, Capture mode, deploy checks, overview | built 2026-10-27; the overview decision and the pass on devices open |
| M5 | Secrets on the device | built 2026-10-27; the pass on devices open |
| M6 | Board Assist | open, needs M5 |
| M7 | Assets in the board finder | open |
| M8 | Settings: licenses and about | built 2026-10-27 with the Settings page; the pass on devices open |
| M9 | Sharing into the app | open |
| M10 | Board finder extras: source, fork, import, QR | open |

The order is the order of value, not of dependency. M8 is small and can go in
whenever there is a gap.

---

## M1: Pin a board to the Home Screen

A saved board or a shipped demo, launched from the Home Screen like any app. The
control is a **Pin** button on the board details panel of the mobile board finder
(`views/start/mobile/MobileBoardDetails.tsx`).

### What iOS allows

**iOS has no public API for an app to put an icon on the Home Screen.** Android
has one (`ShortcutManager.requestPinShortcut`); iOS has nothing equivalent.
Changing the app's own icon (`setAlternateIconName`) is the only icon API there
is. Everything that ends up on an iOS Home Screen is placed there by the person.
So on iOS, Pin makes the board **launchable from everywhere iOS offers**, and
then guides the person through the last step:

| Surface | What the person gets | Steps for them | Notes |
|---|---|---|---|
| **Widget** (WidgetKit, `AppIntentConfiguration`) | A Home Screen tile with the board's name and art; a tap opens the board | Add the Readymade widget, then pick the board | The real "app on the Home Screen". One widget per board. The small size is a 2×2 tile |
| **Shortcuts action** (App Intent "Open Board", `BoardEntity`) | An icon with its own name and image via Shortcuts → Add to Home Screen | Several, in the Shortcuts app | Closest to a plain app icon. Check on a device whether launching shows a Shortcuts banner |
| **Quick actions** (`UIApplicationShortcutItem`, dynamic) | The pinned boards on a long press of the Readymade icon | None | Fully automatic. iOS shows about four |
| **Spotlight and Siri** (`IndexedEntity` / `CSSearchableItem`) | The board found by name in search and by voice | None | Falls out of the App Intent |

On **Android**, Pin calls `requestPinShortcut`, and the launcher asks once to
place a real icon. That is the whole feature there.

A web clip of a readymadeit.com page is **not** the path here. It opens in
Safari, without the embedded runtime, and is a different product.

### Built (2026-10-26)

The app asks the shell through one route family, `hkp://home-screen/`:
`GET`/`POST pins`, `DELETE pins/<kind>/<id>`, `POST launch` and, on iOS,
`POST shortcuts`. Every way in is one link, `readymade://board?saved=<name>` or
`?demo=<slug>`. The shell keeps the board, tells the page
(`window.__readymadeOnLaunch`), and the page takes it from `launch`. Taking
rather than being handed the board makes a cold start (the page does not exist
yet) the same as a warm one.

- [x] **Pin / Unpin** in `MobileBoardDetails`, for saved boards and demos
  (`PinsController` and `isPinnable` in `views/start/types.ts`; `pins` on
  `StartPageProps`, which the desktop ignores). Test:
  `views/start/tests/mobile-pin.test.tsx`.
- [x] **Host side** in `meander/frontend/src/homeScreen/`: the route calls
  (`homeScreen.ts`), the pinned list (`usePins.ts`), and the iOS guide shown
  after pinning (`HomeScreenSheet.tsx`). `MobileApp` opens a launched board the
  way a share opens one: any other board is closed first, and the saved board
  already open stays as it is. A board that has gone (deleted, renamed) says
  so and lands on the start page. Deleting a saved board unpins it.
- [x] **Launch as an app**: nothing was needed. The mobile canvas already opens
  a board with a facade on its App view, and the back button leads to the
  start page.
- [x] **Pinned list** in the App Group on iOS (`Shared/HomeScreenPins.swift`,
  `home-screen-pins.json`) and in SharedPreferences on Android
  (`bridge/HomeScreenPins.kt`). Newest first.
- [x] **iOS quick actions**, rebuilt from the pinned list on every change and at
  launch (`Features/HomeScreen/LaunchRouter.swift`). A SwiftUI app has no scene
  delegate, so the app delegate names `QuickActionSceneDelegate`; a quick
  action that launched the app arrives in the connection options.
- [x] **iOS App Intent** "Open Board" with a `BoardEntity` (pins first, then
  the saved boards the app mirrors into the App Group), and
  `ReadymadeShortcuts` for Siri and Spotlight (`OpenBoardIntent.swift`,
  `Shared/BoardEntity.swift`).
- [x] **iOS widget extension** `ReadymadeWidgets` (`ReadymadeIOS/Widget/`, a
  target in `meander-ios/CMakeLists.txt`). Until a board is chosen it shows the
  one pinned last, so a widget added right after pinning shows that board.
  It needs iOS 17 (`AppIntentConfiguration`); the app stays on iOS 16, where the
  extension does not load.
- [x] **The guide on iOS** after Pin: the widget and the Shortcuts route, with
  a button opening Shortcuts (`shortcuts://`; `ShortcutsLink` is SwiftUI and the
  sheet is the web app's).
- [x] **Android**: `requestPinShortcut` places a launcher icon after one
  confirmation, and the pinned list is the long-press menu (dynamic
  shortcuts). Unpinning disables an icon already placed, since an app cannot
  remove it. A launcher without pinned shortcuts answers `manual`.
- [x] Docs: `targets.md`, "What each host adds".

Verified: both frontends typecheck, the start-page tests pass, the iOS app,
widget and share extension build for a device (`xcodebuild`, unsigned), the
App Intents metadata holds `OpenBoardIntent`, `BoardEntity` and the Siri phrase
(app) and `SelectBoardIntent` (widget), and the Android Kotlin compiles.

### Still open

- [ ] **The pass on devices.** Pin, quick action, widget (add, pick another
  board, tap), the Shortcuts route to a Home Screen icon, Siri "Open … in
  Readymade", each from a cold start and with the app running; on Android, the
  launcher's pin dialog, a placed icon, unpinning it. None of this has run on a
  device yet.
- [ ] Whether launching a Shortcuts icon shows a Shortcuts banner first.
- [ ] Signing: the widget needs the App Group in its provisioning profile, as
  the share extension does. Check App Store validation accepts an extension
  with a higher minimum iOS (17) than the app (16).
- [ ] A pin outlives a rename. Mobile has no rename for saved boards yet, so
  nothing renames a pin; when one is added, it should update the pin too.

### Open

- Board art for the widget and the shortcut icon. Saved boards have art on the
  desktop (`uploadBoardArt`), and demos have their colours (`artFor`). A rendered
  PNG in the App Group is probably enough.
- Whether a pinned board should hide the playground chrome entirely, the way a
  facade does on the desktop (`FacadeChrome`).

---

## M2: Boards in native storage, history and resume

Before this, `MobileApp` kept boards and the finder's folder tree in the
webview's localStorage, which iOS may evict, while units saved by name already
went to `hkp://boards/`. A composition was split across two stores.

### Decided (2026-10-26)

- **Boards live in the app's own library** behind `hkp://boards/`, as on the
  desktop. localStorage stops being a board store on mobile.
- **One file per board, named the desktop's way**: `<encoded name>.hkpp`, with
  the encoding of `meander/backend/boardName.h`. Swift and Kotlin implement the
  same rule; the Swift and C++ encoders were compared on awkward names
  (separators, dots, `%`, non-ASCII, control characters) and agree.
- **iCloud container `iCloud.com.readymadeit.readymade`**, shown as "Readymade".
  Neutral, so the Mac app can join it formally later. Permanent once created.
- **iCloud by default, local fallback.** With iCloud Drive off, boards stay in
  the app's Documents, visible in Files under On My iPhone. Boards kept locally
  move into iCloud once it is on.
- **Only the boards sync.** History and the finder's folder tree stay on each
  device: history is rewritten at every pause in editing, which is constant
  traffic for iCloud and a conflict when two devices edit at once.
- **On the Mac, an iCloud source in the finder.** A board opened from it saves
  back there; `~/.hkp` stays where new boards go, so nothing existing moves.

### Built (2026-10-26)

- [x] **iOS board library** (`Features/Boards/BoardLibrary.swift`): one queue
  for all board files, which first resolves the container, renames the old
  `<name>.json` boards, and adopts local boards into iCloud, so no request
  sees it half-prepared. Coordinated reads and writes; a board iCloud has not
  downloaded yet (`.<file>.icloud`) is listed and asked for. `hkp://boards/` is
  answered from that queue, and only for tasks WebKit has not stopped.
- [x] **iOS** `hkp://history/` and `hkp://startpage` in Application Support,
  with the desktop's history rules (50 entries, consecutive "config" entries
  collapse, the registry stripped).
- [x] iCloud entitlements and `NSUbiquitousContainers` (public scope),
  `UIFileSharingEnabled` and `LSSupportsOpeningDocumentsInPlace`.
- [x] The board-name mirror for the share extension and the Open Board intent
  is written by the library on every change. The web app no longer posts it
  (`hkpShareBoards` and `mirrorBoardsToNative` are gone).
- [x] **Android**: the same naming (`BoardFileName` in `bridge/BoardStore.kt`),
  old `.json` boards renamed, `hkp://history/` and `hkp://startpage`. Fixed on
  the way: board and preset names were percent-decoded twice, so a name with
  `%` failed and `+` became a space.
- [x] **Web**: `core/boardLibrary.ts` (hkp-frontend) is the one place that
  decides between the host's library and localStorage, through the new
  `listSavedBoards` / `deleteSavedBoard` platform capabilities. The Hub tab, the
  save sheet and the playground's load-by-name use it. Test:
  `core/tests/board-library.test.tsx`.
- [x] **`MobileApp`** lists, describes, creates and deletes boards through the
  backend; the finder's tree comes from `hkp://startpage`; snapshots go to the
  history; the finder shows a board's history and offers Continue.
- [x] **Migration** (`meander/frontend/src/library/migrateLocalBoards.ts`): once
  per launch, before anything lists or opens a board, every localStorage board
  is copied into the library (a taken name gets " (n)") and removed from
  localStorage only once its copy is in; the folder tree comes along when the
  library has none.
- [x] History and resume are shared by both hosts
  (`meander/frontend/src/library/boardHistory.ts`); the desktop's `App.tsx` and
  `MeanderPlayground.tsx` use it too.
- [x] **Desktop**: `meander/backend/sharedBoards.h` (tests:
  `tests/sharedBoards.test.cpp`) and `hkp://shared-boards/`; an **iCloud**
  source in the finder (`library/useICloudSource.ts`), a new board action
  `{ kind: "icloud" }`, and the session's library carried to Save and to
  Continue.
- [x] Docs: `targets.md`, "Where boards live".

Verified: both frontends typecheck and the hkp-frontend suite passes; the iOS
app builds for a device; the Android Kotlin compiles; the desktop app builds
with the new routes, and its backend tests pass (76, six new).

### Still open

- [ ] **The pass on devices.** On first launch the container is created: check
  that Files shows "Readymade" in iCloud Drive, that boards saved on the phone
  appear in Finder on a Mac and in the desktop's iCloud source, and that a board
  saved back from the Mac reaches the phone. With iCloud Drive off: boards in On
  My iPhone; turning it on moves them. The migration with real localStorage
  boards, including a name clash.
- [ ] **Signing**: the iCloud capability and the container have to be added to
  the app's identifier (automatic signing should do it from the entitlements;
  otherwise once in Signing & Capabilities). Raise the build number for a
  device that already had the app, or iOS keeps the old container settings.
- [ ] The desktop writes into iCloud Drive without file coordination (it is
  C++); a board edited on the phone and the Mac at the same moment can end in an
  iCloud conflict copy. Deleting from the Mac's iCloud source is not offered.
- [ ] Board art on mobile (`<encoded>.art` beside the board on the desktop) is
  M10.
- [ ] A board renamed by the migration (" (2)") is not renamed in the folder
  tree or in pins that named it.

### Open

- Android has no iCloud. Its boards stay in app storage; Google Drive or
  Storage Access Framework export is a separate question and is not planned.
- Presets (`Documents/Presets` on iOS) probably belong in the shared folder too.

---

## M3: Building: presets, blocks, Run and Run with…

### Built (2026-10-27)

Every piece calls logic that now lives in `core/` or is exported beside the
desktop component that used it; the desktop calls the same code, and its tests
pass unchanged.

- [x] **Shared first.** What a palette offers moved out of `Sidebar` into
  `core/palette.ts` (`paletteFor`, `paletteKey`); running a runtime and running
  from a service out of `RuntimeHeader` and `ServiceSettings` into `core/play`
  (`runRuntime`, `runFrom`); parsing a hand-written payload out of
  `RunParamsDialog` into `core/runPayloads` (`parseRunJson`, `isTextFile`,
  `readFileText`, `RunPayloadMode`). Exported, not moved: `applyPresetTo`
  (`PresetMenu`), `savePresetFrom` (`SavePresetDialog`), `wrapRun`,
  `makeBlockOfRun`, `blockNameForRun` (`WrapSelection`), `serviceDocsUrl`
  (`ServiceFrame`).
- [x] **`AddServiceSheet`** lists the runtime's entries from `paletteFor`
  behind a switcher: Services (first, what is added most often) and Building
  Blocks (blocks and composed presets, each under its heading), with counts. A
  search that finds nothing in the tab shown offers the other tab's matches. A
  runtime offering services alone shows no switcher. The
  sub-pipeline picker inside a service still offers services only (as the
  desktop's nested selector does; `concepts/blocks.md`, "Known gaps").
- [x] **Service sheet** rows: Run, Run with…, Presets, Make block, Edit block,
  Apply to block / Cancel editing, Detach from block, Documentation. The working
  copy of a block is unlocked in the sheet (Configure, the sub-pipeline) while it
  is edited. Make block is offered for a sub-service only: one ordinary service
  is rarely worth a block, and a preset keeps its configuration.
- [x] **Presets sheet** (`PresetsSheet.tsx`): apply one, or keep the
  configuration as a preset with tags. Storage is the shells' `hkp://presets`,
  already attached on iOS and Android (`MeanderPlatformProvider`).
- [x] **Run sheet** (`RunSheet.tsx`): Fields, Text, JSON, File, and the payloads
  saved per board, in the same store as the desktop's dialog.
- [x] **Runtime card menu**: Run, Run with…, Select services, Make block (every
  service in the runtime, after naming it; a runtime holding just one
  sub-service makes that one a block where it is), Clear services (asks by a
  second tap), Delete Runtime. The desktop's runtime menu has Wrap in
  SubService for the whole runtime but no Make block; worth adding there too.
- [x] **Selection mode**: boxes in place of the chevrons, and a bar sticking to
  the bottom of the list with Wrap and Make block, enabled once the picked
  services are a run.
- [x] **Play and Play with…** in the top bar (`core/play`, under a
  `PlayProvider`), lit while Play carries the last input.
- [x] **Deployed boards** (`MobileCloudBoards`, the canvas with a `bridge`) get
  Run and saving a preset, and nothing that rebuilds the board: no applying a
  preset, Make block, Edit, Detach, selection or Clear.
- [x] Docs: `concepts/blocks.md` and `concepts/presets.md`.

Tests: `core/tests/palette.test.ts`, `core/tests/play.test.ts` (runRuntime,
runFrom), `tests/mobile-building.test.tsx` (run sheet, add sheet, service sheet
actions and block states, runtime menu, selection mode, deployed boards). The
hkp-frontend suite passes (2529) and both frontends typecheck.

### Still open

- [ ] **Services with several pipelines cannot be navigated on a phone.**
  Checked in the code rather than on a device, and it is not a maybe: Switch,
  If, Feedback, Tracks, Hold, HttpEndpoint and CommunicationDispatcher draw
  their pipelines through `SubServicePipelineUI`, which renders nothing on a
  mobile host (it leaves `pipeline` to the sheet's own drill-in). A section shows
  its name and count, and nothing inside it can be seen or changed. The sheet's
  trail walks `state.pipeline` and wraps edits in `configureService`; a section
  has its own shape per service (`cases[].pipeline`, `tracks[]`, …) and its own
  edit route (`NamedPipelinesPanel`'s `onEdit`). Proposed: on a mobile host,
  `SubServicePipelineUI` draws `MobileSubPipeline` for a section (list, add,
  remove, reorder through the proxy's `configure`, which already speaks that
  protocol), and drilling into an entry of a section becomes a crumb that
  carries how to configure through it rather than only an instance id.
- [ ] **The pass on devices**: the sheets at phone size, the sticky selection bar
  (`overflow: clip` on the runtime card, iOS 16+), the file picker in Run with…,
  Documentation opening outside the app.
- [ ] Adding a block inside a sub-pipeline from the sheet (the desktop lacks it
  too).

---

## M4: Observing: flow inspector, Capture mode, deploy checks, overview

Delivering the observability promise on the go. The same features apply to
**cloud boards** (`MobileCloudBoards` over the coordinator bridge), because
watching a deployment is the main reason to observe from a phone.

### Built (2026-10-27)

- [x] **Shared first.** Reading a call report moved out of `ServiceFrame` into
  `ui-components/service/flowRecords.ts` (`readCallReport`), with
  `rememberFlow` and the inspector's text helpers out of `ServiceOutputPlug` and
  `FlowInspectorPopup` (`previewFlow`, `timeOf`, `tooLargeNote`, `flowText`,
  `editedValue`). `ProcessingSweep` takes a colour. The desktop reads reports
  through the same function, and its tests pass unchanged.
- [x] **The board's flow** (`views/playground/mobile/boardFlow.tsx`): the
  desktop keeps a service's history in its frame, which is on screen as long as
  the board is; a phone opens a service only when asked, so a history begun in
  the sheet would miss everything before it. `BoardFlow` listens to every
  service a runtime holds from the moment the canvas is shown, outside React
  (a clock-driven board reports many times a second), and only the card and
  sheet of the service that reported re-render.
- [x] **Activity on the board list**: a card is tinted while its service runs
  and the sweep bar crosses once per run (`useProcessingSweep`, fed by the
  board's flow); its dot turns teal.
- [x] **Capture mode** (`capture.tsx`): a round button beside Play in the top
  bar, as on the desktop (the four controls sit closer together to leave the
  board's name room on the smallest phones). A cloud board has the same button
  in its top bar, asking the coordinator (`setCoordinatorBoardCapture`), and
  the canvas is handed that switch, so the prompt in a service's Flow asks the
  coordinator too. The browser runtimes a cloud board hosts follow it, and
  leaving the Cloud tab turns it off, as the desktop's Cloud Boards view does.
- [x] **Flow inspector** in the service sheet (`MobileFlowInspector.tsx`): a
  **Flow** row whose sublabel already says what the service did last; it opens
  Input / Output with counts, the history (time and one line each), the value
  in an editable field, Edited · Revert, Copy, and Rerun / Inject. A value too
  large to keep is shown read-only with the desktop's note. With Capture mode
  off it says so in the desktop dialog's words, in place, with a button that
  turns it on. Rerun and Inject are out of reach on a block's use, as its
  configuration is.
- [x] **Expanded service cards** (asked for after the first pass): a tap on a
  card expands it in place rather than opening its sheet. While Capture mode is
  on it shows what the service passed on last, kept current; while it is off,
  a line saying so and Turn on. **Inspect** opens the flow inspector on its own
  (`FlowSheet.tsx`), **UI** unfolds the service's own panel below the buttons,
  the card's full width (`ServiceUIPanel`, built by the same `rootServiceUI`
  the sheet uses), and **…** the service's sheet — in the order UI, Inspect,
  …. Each card expands on its
  own, so several services can be watched at once, and only an expanded card
  re-renders on a value. Rerun / Inject go through one function for both
  sheets (`flowActions`). The runtime header's full view (every service's
  panel at once, browser runtimes only) is gone: a card's UI does its job, for
  any runtime, one service at a time.
- [x] **Deploy checks**: `DeployBoardSheet` asks `checkDeploy` as it opens
  (the findings do not depend on the coordinator), lists each runtime's finding
  as `DeployDialog` does, keeps the coordinators out of reach while one blocks
  the deploy, offers Check again, and shows the findings of a deploy that
  preflight stopped after all instead of a toast.
- [x] Docs: `concepts/runtime.md` ("What crosses a runtime boundary") and
  `concepts/cloud-boards.md` (the deploy findings, the Capture switch; the
  "no per-runtime dialog" gap is gone).

Tests: `ui-components/service/tests/flow-records.test.ts` (reading reports),
`tests/mobile-observing.test.tsx` (the board's flow, card activity, Flow in the
sheet with Inject and an edited Rerun, the Capture prompt locally and on a
deployed board, the switch), `tests/mobile-deploy-sheet.test.tsx` (findings,
blocking, Check again, a deploy stopped by preflight). The hkp-frontend suite
passes (2971) and both frontends typecheck.

### Still open

- [ ] **Overview** (`overview/`): the whole board as one live graph,
  read-only, with pinch to zoom and pan to move. The flow inspector is in, so
  this is now to be decided: is a graph worth it on a phone, or is the board
  list with live cards enough for observing bigger boards?
- [ ] **The pass on devices**: the Capture button and the cloud one (the
  coordinator's round trip, the browser runtimes following it), the Flow view
  at phone size and the keyboard over the value field, the sweep on cards of a
  clock-driven board, the deploy findings against a real unreachable server.
- [ ] **Services inside a sub-service have no Flow.** The board's flow listens
  to what a runtime holds itself; a nested service reports under its address
  (`overview/activity.ts` registers by it), and Rerun / Inject would go by it
  too. Worth doing with M3's multi-pipeline drill-in, which needs the same
  addressing.
- [ ] One Capture mode per window, as on the desktop: the local board and the
  Cloud tab share it, so opening a cloud board sets it to that board's, and
  leaving the Cloud tab turns it off for the local board as well.

---

## M5: Secrets on the device

A must-have. Boards with `{{secret.…}}` could not run on a phone, because the
vault was the desktop backend's (`saucer.exposed`, `meander/backend/vault.h`).

### Decided (2026-10-27)

- **No second design.** `TODO-SECRETS.md` Prio B is about provisioners without
  a native vault (the website store, the coordinator's). A phone is a native
  provisioner like the desktop, so it gets the desktop's shape exactly: the
  page reads an injected copy (`vault.ts`, `grants.ts`), writes go to the host,
  grants are kept by the host, and the alias is the interface between vaults.
  Nothing syncs a phone's secrets anywhere.
- **On the device only.** iOS: Keychain items with
  `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` — not in iCloud Keychain,
  not restored onto another phone, readable whenever the app runs after the
  first unlock. Android: the Keystore holds keys, not data, so each entry is
  sealed with an AES-GCM key that never leaves it and kept in private
  preferences; a backup restored elsewhere carries ciphertext without the key
  and reads as empty. Grants name secrets and hold none, so they are a file
  (Application Support; the app's files).
- **One route family on both shells**, `hkp://secrets/` (`values`,
  `values/<alias>`, `grants`), described in `targets.md`, "Where secrets live".
  `meander/frontend/src/backend/meander.ts` uses it when there is no
  `saucer.exposed`, so the web app has one adapter for three hosts.
- **The route answers only the app's own page.** Every other `hkp://` route
  answers `*`; this one requires a per-launch token injected with the vault
  (`X-Hkp-Secrets-Token`), because an iframe shares the scheme on iOS and the
  bridge object on Android. Chosen over checking `Origin`, which a custom
  scheme may state as `null`.
- **Secrets live in Settings, not on the account page** (asked for after the
  first pass, which had put them under the account). A phone gets the desktop
  dialog's sections as a **Settings** page: a list, each section its own page,
  opened from a gear on the start page and from Settings in a board's menu.
  None of it needs an account, so the avatar is the account again.

### Built (2026-10-27)

- [x] **iOS** (`Features/Secrets/DeviceVault.swift`): `DeviceVault` (Keychain),
  `SecretGrants` (`grants.json`), `SecretsPage` (the token, and the
  `WKUserScript` for the app's own pages — `hkp://app`, and the dev server's
  origin in Debug). The script is replaced after every change, because iOS
  reloads a page whose content process it reclaimed and a script written at
  launch would bring back a deleted secret. `hkp://secrets` in
  `BoardListView.swift`.
- [x] **Android** (`bridge/DeviceVault.kt`): `DeviceVault`, `SecretGrants`,
  `SecretsPage`; the values, grants and token are written into `index.html` as
  `MainActivity` serves it (escaped for an inline script), and `index.html` is
  now `no-store`. `hkp://secrets` in `HkpSchemeRouter`.
- [x] **Web**: the backend adapter falls back to `hkp://secrets` without
  `saucer`; `main.tsx` already turned on host grants when `__HKP_GRANTS__` is
  injected, and `SecretConsentDialog` was already mounted in `MobileApp`.
- [x] **Shared first**: what `SecretsTab` did beside its layout moved into
  `views/secrets/secretsModel.ts` (`useSecrets`, `parseAudience`,
  `secretProblem`); the desktop tab uses it unchanged in behaviour.
  `MobileAccountPage`'s frame became `views/playground/mobile/MobilePage.tsx`;
  `RuntimeAccessSheet`'s content became `RuntimeAccessContent`.
- [x] **Settings page** (`views/settings/MobileSettingsPage.tsx`, the host's
  sections in `meander/frontend/src/MobileSettings.tsx`): About, Appearance,
  Connections, Secrets, Access, Licences — the desktop dialog's tabs in its
  order. A section written in the settings kit (`kitSection`) is the desktop
  tab's own content in a page, with inputs raised to 16px so iOS does not zoom.
  Board Assist is left out until M6 gives a phone Assist to configure. Opened
  over whatever is showing (`onOpenSettings` on the start page and the mobile
  playground); in a board's menu it replaces the Runtime access row, which a
  host without settings still gets. The stored coordinators now announce a
  change (`COORDINATORS_CHANGED` in `common.tsx`), so a coordinator added in
  Settings reaches a board already open.
- [x] **Secrets page** (`views/secrets/MobileSecretsPage.tsx`): the stored
  secrets as references with their audience (an unconstrained one says it will
  be pinned on first use), Add secret, a sheet per secret to change its hosts
  or replace its value (never shown) and to remove it on a second tap, the
  runtimes allowed with Forget, and where this phone keeps them.
- [x] Docs: `targets.md` (the hosts table, "Where secrets live").

Tests: `tests/mobile-secrets.test.tsx` (listing, add with and without an
audience, a refused name, changing hosts and value separately, remove on a
second tap, a refusal from the store, forgetting a grant, a shell with no
store); `tests/mobile-settings.test.tsx` (section order, a section as a page
and back, a kit section framed, the board menu with and without settings, a
coordinator stored elsewhere reaching a list already showing); the start
page's gear in `tests/mobile-start-sources.test.tsx`. The hkp-frontend suite passes
(2991) and both frontends typecheck; the backend adapter's route calls were
checked once against a stubbed `fetch`. The iOS app builds for a device
(`xcodebuild`, Debug, unsigned) and the Android Kotlin compiles. Nothing has
run on a device.

### Still open

- [ ] **The pass on devices.** Add a secret, open a board that names it in a
  browser runtime and in the embedded runtime (no prompt) and in a remote one
  (the prompt, then Don't ask again surviving a relaunch); delete one and
  check a reload no longer resolves it; an iOS page reload after the content
  process is killed; the token check against a real WebKit preflight (the
  route answers `OPTIONS` with the header allowed, but nothing has run it).
- [ ] **Settings at phone size**: the kit sections (About, Appearance,
  Connections, Licences) were written for the desktop dialog's pane and are
  checked only in jsdom. Appearance changes the theme, accent and font on the
  document; the mobile tree draws itself in its own fixed colours
  (`tokens.ts`), so on a phone it reaches the service panels and the kit
  pages rather than the cards. Whether that is enough to keep the section, or
  the mobile tree should follow the accent, wants a look on a device.
- [ ] **Keychain items outlive the app on iOS**: deleting and reinstalling
  keeps the secrets while the grants (a file) are gone. Probably right — the
  next board asks again — but worth deciding whether a first launch should
  clear them.
- [ ] A secret changed while a board runs is not pushed to its runtimes, as
  on the desktop (`TODO-SECRETS.md`, 3b).
- [ ] Assist's provider token in the vault is M6.

---

## M6: Board Assist

Needs M5: the provider token belongs in the vault, not in localStorage, where
`assist/settings.ts` keeps it today.

- [ ] A full-screen **Assist** page, opened from the top bar: prompt, streamed
  answer, and the proposed change as a preview to accept or discard
  (`BoardAssistPreview`, `snapshotComparison`, `validation`). The panel itself is
  desktop layout. The logic under it (`anthropic.ts`, `openAICompatible.ts`,
  `scope.ts`, `mcpKnowledge.ts`) is used as it is.
- [ ] Scope: the service or runtime the person has open stands in for the
  desktop's selection (`SelectionContext`).
- [ ] **Assist settings** (provider, model, endpoint) as a section of the
  Settings page (M5), with the token stored as a secret. The desktop moves to the same store, so a token
  is kept in one place.

---

## M7: Assets in the board finder

The asset view lives in the **board finder**, not in the playground's toolbar.

- [ ] **Assets** in a board's details panel: the list (name, id, media type,
  where the content is, size) and an editor page for one asset (text in a code
  editor, a preview for images and audio, replace from Files or Photos). It
  edits the saved board document. Nothing is running yet, so there is no Apply.
- [ ] While a board is open, the board menu leads to the same page with **Apply**,
  which pushes the descriptor to the runtimes referencing it, as `AssetView` does.
- [ ] Add and remove assets, and see which services reference each one.

### Open

- Whether "Assets" should also be a source of its own in the finder (every
  board's assets in one place) rather than only a per-board section.

---

## M8: Settings: licenses and about

- [x] **Licences**, a section of the Settings page (M5): the desktop tab's
  content (`LicencesTabContent`) for the phone's own surface (`currentSurface`).
- [x] **About**, a section of the Settings page: version, the build's commit
  (linked), and the embedded runtime's address.
- [ ] The pass on devices: the licence list's length and its full texts at
  phone size, the commit link opening outside the app.

---

## M9: Sharing into the app

### Whether a share can open the app

Rechecked on 2026-10-26: **still true on iOS.** Apple's position (DTS, on the
developer forums) is that app extensions may not open URLs, deliberately. The
responder-chain workaround (`openURL:` reached through the responder chain) went
silent on iOS 18 and is reported dead on iOS 26. Relying on it would also put App
Review at risk. So a share extension cannot reliably bring Readymade to the front.

Apps that do appear to "continue in the app" usually do one of three things:

1. **They open a file, not a share.** An app declaring document types
   (`CFBundleDocumentTypes`) appears as an "Open in…" or "Copy to…" target for
   *files* (PDFs, images, audio). Choosing it launches the app with the file
   (`onOpenURL`). That is a real, supported launch, but it does not apply to a
   web link shared from Safari.
2. **A full-screen extension**: the extension's UI fills the screen and looks
   like the app, but it is still the extension.
3. **The old workaround**, on an older iOS.

**Which apps did you have in mind?** Checking one or two of them would tell us
which of these it is.

### Work

- [ ] **iOS: Open in Readymade for files.** Declare document types for the media
  boards consume (images, audio, PDF, JSON, `.hkpp` from M2). A file then launches
  the app, and the in-app picker (`ShareBoardPicker`) chooses the board. This is
  the "launch and continue in the app" path, for files.
- [ ] **iOS: links and text** stay with the extension and its mailbox. After
  saving, it posts a local notification ("Open in Readymade"), which Apple
  recommends, so one tap brings the app up with the share waiting.
- [ ] **Android: share target.** An `ACTION_SEND` / `ACTION_SEND_MULTIPLE` intent
  filter on `MainActivity`. On Android sharing *does* launch the app, so the
  in-app picker is used directly, with no mailbox. Android has no sharing yet.

---

## M10: Board finder extras

- [ ] **Edit board source** (`loadBoardSource`, `saveBoardSource`) with the
  mobile `JsonEditor`.
- [ ] **Fork** a cloud board (`forkBoard`).
- [ ] **Import a board from a file** (`onLoadBoard`, via the document picker).
- [ ] **Share as QR**: the board's share link as a QR code (`ShareQRCodeDialog`),
  beside "copy link" in the board menu.
- [ ] Board art (`uploadBoardArt`, `pickBoardArtImage` from Photos), which M1's
  widget and shortcut icons reuse.

---

## Not planned for mobile

Agreed 2026-10-26:

- **Runtime zoom**: mobile has its own zoom for service UIs.
- **Retracting the toolbar over the facade** (`FacadeChrome`): the App / Board
  toggle does that job.
- **The selection-aware sidebar** and blocking swipe navigation: both are
  desktop-only behaviours.
- **Local model backends** (speech, llama): a build decision
  (`3rdparty/CMakeLists.txt`), not UI.

Not requested, so not planned until someone asks:

- **Facade editor**: designing a facade is desktop work. Editing the facade's
  JSON through the board source (M10) remains possible.
