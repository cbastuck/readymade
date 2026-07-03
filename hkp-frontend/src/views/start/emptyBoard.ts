import { BoardDescriptor } from "../../types";

/** A minimal named board — a browser runtime with no services yet — used by
 *  the "New board" control inside start-page folders. */
export function createEmptyBoard(name: string): BoardDescriptor {
  return {
    boardName: name,
    runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
    services: { ui: [] },
  };
}
