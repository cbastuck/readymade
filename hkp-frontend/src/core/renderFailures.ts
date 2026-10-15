export const BOARD_RENDER_FAILURE_EVENT = "hkp-board-render-failure";

export type BoardRenderFailure = {
  scope: string;
  message: string;
};

export function reportBoardRenderFailure(failure: BoardRenderFailure) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<BoardRenderFailure>(BOARD_RENDER_FAILURE_EVENT, {
      detail: failure,
    }),
  );
}

function letReactCommit() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/**
 * Runs a board load while render boundaries collect failures from the React
 * commit it triggers. Two tasks cover the state update and its effects without
 * tying the transaction to animation frames, which may pause in a hidden tab.
 */
export async function captureBoardRenderFailures<T>(
  action: () => Promise<T>,
): Promise<T> {
  if (typeof window === "undefined") return action();
  const failures: BoardRenderFailure[] = [];
  const receive = (event: Event) => {
    const detail = (event as CustomEvent<BoardRenderFailure>).detail;
    if (detail) failures.push(detail);
  };
  window.addEventListener(BOARD_RENDER_FAILURE_EVENT, receive);
  try {
    const result = await action();
    await letReactCommit();
    await letReactCommit();
    if (failures.length) {
      const summary = failures
        .map(({ scope, message }) => `${scope}: ${message}`)
        .join("; ");
      throw new Error(`The proposed board could not render. ${summary}`);
    }
    return result;
  } finally {
    window.removeEventListener(BOARD_RENDER_FAILURE_EVENT, receive);
  }
}
