import { WithRouterProps } from "../../common";
import { BoardContextState } from "../../BoardContext";
import { BoardDocuments } from "../../core/boardPersistence";
import { BoardSnapshot } from "../../core/boardSnapshots";
import { UnitBoard } from "../../runtime/board/units";
import {
  BoardDescriptor,
  RuntimeClass,
  BoardMenuItemFactory,
} from "../../types";

export type PlaygroundProps = WithRouterProps & {
  boardName?: string;
  compact?: boolean;
  availableRuntimeEngines?: Array<RuntimeClass>;
  onUpdateAvailableRuntimeEngines?: (
    runtimeClasses: Array<RuntimeClass>,
  ) => void | Promise<void>;
  boardDescriptor?: BoardDescriptor;
  children?: React.ReactNode;
  hideNavigation?: boolean;
  menuSlot?: React.ReactNode;
  logoSlot?: React.ReactNode;
  menuItemFactory?: BoardMenuItemFactory;
  onChangeBoardname?: (newName: string) => void;
  /**
   * Where `boardDescriptor` was read from — a file URI or a URL. A composition
   * resolves the units it names relative to this, so a board opened from a file
   * finds its neighbours without anything having been copied first.
   */
  boardSource?: string;
  /**
   * Unit documents handed over with `boardDescriptor`, keyed by the `uri` that
   * names them.
   *
   * A composition resolves its units against where it was loaded from, and a
   * board that was restored rather than opened has no such place: a resumed
   * session was never at a URL, and the files a composition was dropped as are
   * long gone. So the documents travel with it, and are tried before anything
   * that has to go looking.
   */
  unitDocuments?: Record<string, UnitBoard>;
  onSaveBoard?: (name: string, payload: BoardDescriptor) => void;
  onUpdateBoardState?: (newBoard: BoardDescriptor) => void;
  onNewBoard?: (ctx?: BoardContextState) => void;
  onBoardInfrastructureChange?: (
    board: BoardDescriptor,
    documents: BoardDocuments,
  ) => void;
  /** See `onBoardSnapshot` on BoardProvider (core/boardContextTypes). */
  onBoardSnapshot?: (snapshot: BoardSnapshot) => void;
  /**
   * Keep what an unsaved board was changed to in this browser, so reloading
   * its address brings it back (core/boardDrafts). For a host that saves to
   * local storage and routes by board name — the website. Ignored when the
   * host takes the snapshots itself (`onBoardSnapshot`).
   */
  keepDrafts?: boolean;
  emptySlot?: React.ReactNode;
};

export type PlaygroundInnerProps = {
  description: string;
  compact?: boolean;
  hideNavigation?: boolean;
  menuSlot?: React.ReactNode;
  logoSlot?: React.ReactNode;
  menuItemFactory?: BoardMenuItemFactory;
  showShareBoardQRCodeURL: string | null;
  setShowShareBoardQRCodeURL: (url: string | null) => void;
  isSaveDialogVisible: boolean;
  suggestedName: string;
  onSaveDialog: (
    name: string,
    desc: string,
    isSuggestedName: boolean,
  ) => Promise<any>;
  setIsSaveDialogVisible: (v: boolean) => void;
  onChangeBoardname: (newName: string) => void;
  onUpdateAvailableRuntimeEngines?: (
    runtimeClasses: Array<RuntimeClass>,
  ) => void | Promise<void>;
  requestedBoardName?: string;
  children?: React.ReactNode;
  emptySlot?: React.ReactNode;
};
