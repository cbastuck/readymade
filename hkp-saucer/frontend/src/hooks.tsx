import { useContext } from "react";
import { BoardCtx } from "hkp-frontend/src/BoardContext";
import { loadBoard } from "./actions";

type JsApi = {
  loadBoard: (name: string) => Promise<void>;
};

declare global {
  interface Window {
    hkpJS: JsApi;
  }
}

export function useJsApi() {
  const boardContext = useContext(BoardCtx);
  const hkp: JsApi = {
    loadBoard: async (path: string) => {
      const name = (path.split("/").pop() || "unknown").split(".")[0];
      boardContext?.setBoardState(await loadBoard(name));
    },
  };
  window.hkpJS = hkp;
}
