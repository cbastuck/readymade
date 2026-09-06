import { BoardDescriptor } from "hkp-frontend/src/types";
import { SavedBoardEntry, StartPageTree } from "hkp-frontend/src/views/start";
import { Remote } from "../types";

export type BoardHistoryEntry = {
  timestamp: string; // ISO 8601
  label: "auto" | "manual";
  snapshot: BoardDescriptor;
};

export type HistoryBoardSummary = {
  name: string;
  latestTimestamp?: string; // ISO 8601
};

export type PickerOptions = {
  initial?: string;
  filters?: string[];
};

// Runtime-access settings backed by ~/.hkp/settings.json (desktop). Changes take
// effect on the next app start.
export type RuntimeSettings = {
  allowExternalRuntimeAccess: boolean;
  allowedUsers: string[];
};

export interface BackendAdapter {
  // Boards
  fetchSavedBoards(): Promise<Array<string>>;
  // The same listing with each board's last-write time, for the start page's
  // details panel and its "recent" sort.
  fetchSavedBoardEntries(): Promise<Array<SavedBoardEntry>>;
  loadBoard(boardName: string): Promise<BoardDescriptor>;
  saveBoard(name: string, payload: BoardDescriptor): Promise<void>;
  deleteBoard(name: string): Promise<void>;
  // The stored board as text, unparsed, and the way back. Optional: hosts
  // without them fall back to loadBoard/saveBoard, which cannot carry source
  // that does not parse.
  loadBoardSource?(boardName: string): Promise<string>;
  saveBoardSource?(name: string, source: string): Promise<void>;

  // Remotes
  getRemotes(): Promise<Array<Remote>>;
  saveRemote(remote: Remote): Promise<void>;
  deleteRemote(name: string): Promise<void>;

  // Runtime-access settings (settings.json). Optional: absent on hosts without
  // a settings store; callers should feature-detect.
  getRuntimeSettings?(): Promise<RuntimeSettings>;
  setRuntimeSettings?(settings: Partial<RuntimeSettings>): Promise<RuntimeSettings>;

  // Secrets a board refers to by alias ({{secret.<alias>}}). Values are held
  // by the host, never by a board — see hkp-frontend/src/core/secrets.ts.
  // Optional: absent on hosts with no secret store, which callers feature-
  // detect before offering to manage them.
  listSecrets?(): Promise<string[]>;
  setSecret?(alias: string, value: string): Promise<void>;
  deleteSecret?(alias: string): Promise<void>;
  // Where each alias may be sent, as alias -> hosts. Empty, or an alias that
  // is absent, means unconstrained. Carries no values: the constraint can be
  // shown and edited without reading the thing it constrains.
  listSecretAudiences?(): Promise<Record<string, string[]>>;
  setSecretAudience?(alias: string, audience: string[]): Promise<void>;

  // Which board may hand which secrets to which runtime — the remembered
  // answers to the consent prompt, keyed as core/secretConsent.ts says. Names
  // only; no values pass through here.
  grantSecrets?(key: string, aliases: string[]): Promise<void>;
  revokeSecretGrant?(key: string): Promise<void>;

  // Mints a short-lived capability token from the embedded runtime, scoped to
  // processing `runtimeId` (POST /runtimes/<runtimeId>). Returns null if the
  // host can't mint. Absent on the plain-browser backend. One transport per
  // capability: add a sibling method when a new mint-token action is needed.
  mintProcessRuntimeToken?(runtimeId: string): Promise<string | null>;

  // Start page folder tree (startpage.json next to the saved boards)
  loadStartPageTree(): Promise<StartPageTree | null>;
  saveStartPageTree(tree: StartPageTree): Promise<void>;

  // Board artwork image (stored next to the board file); returns the URL to
  // render the image from.
  uploadBoardArt(boardName: string, image: Blob): Promise<string>;

  // Board history
  fetchHistoryBoards(): Promise<Array<HistoryBoardSummary>>;
  pushBoardSnapshot(boardName: string, entry: BoardHistoryEntry): Promise<void>;
  loadBoardHistory(boardName: string): Promise<Array<BoardHistoryEntry>>;
  clearBoardHistory(boardName: string): Promise<void>;


  // File picker (native desktop only; returns null in browser or when cancelled)
  pickFile(options?: PickerOptions): Promise<string | null>;
  pickFolder(options?: PickerOptions): Promise<string | null>;
  pickSavePath(options?: PickerOptions): Promise<string | null>;

  // Native file I/O (desktop only; throws in browser)
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
}
