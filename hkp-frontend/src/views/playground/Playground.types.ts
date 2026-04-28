import { WithRouterProps } from "../../common";
import { BoardContextState } from "../../BoardContext";
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
  onSaveBoard?: (name: string, payload: BoardDescriptor) => void;
  onUpdateBoardState?: (newBoard: BoardDescriptor) => void;
  onNewBoard?: (ctx?: BoardContextState) => void;
  onBoardInfrastructureChange?: (board: BoardDescriptor) => void;
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
