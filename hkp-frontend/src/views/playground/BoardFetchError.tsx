import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import Alert from "hkp-frontend/src/ui-components/Alert";
import Button from "hkp-frontend/src/ui-components/Button";

import { BoardContextState } from "../../BoardContext";
import {
  chainUnitOrigins,
  filesUnitOrigin,
  isUnitLinkError,
  nativeFileUnitOrigin,
} from "../../core/linkUnits";
import {
  PlatformCapabilities,
  usePlatform,
} from "../../platform/PlatformContext";
import { UnitBoard } from "../../runtime/board/units";
import { isBoardDescriptor } from "../../types";
import { readFile } from "./common";

type Props = {
  boardName: string;
  error: Error;
  boardContext?: BoardContextState;
};

export default function BoardFetchError({
  boardName,
  error,
  boardContext,
}: Props) {
  const missing = isUnitLinkError(error) ? error.missing : [];
  const board = isUnitLinkError(error) ? error.board : undefined;

  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        flex: 1,
      }}
    >
      <h1>
        Restoring "<span className="capitalize">{boardName}</span>" failed
      </h1>
      <div className="p-10 w-[80%] mx-auto">
        <Alert
          className="w-full text-red-400 font-serif"
          title="Error"
          icon={<TriangleAlert className="h-4 w-4" />}
        >
          {error.message}
        </Alert>
        {missing.length > 0 && board && boardContext && (
          <MissingUnits
            missing={missing}
            board={board}
            boardContext={boardContext}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Offers to go and get the units a composition could not find.
 *
 * A board arrives here having been opened in a way that carries no way back to
 * its neighbours — a single file dropped in, a board restored from local
 * storage — and no amount of guessing will find them, because a page is told
 * nothing about the folder a file came from. Asking is the remedy, and the
 * files the reader picks become the origin the board links against, so the same
 * reference resolves without the composition being edited.
 */
function MissingUnits({
  missing,
  board,
  boardContext,
}: {
  missing: string[];
  board: UnitBoard;
  boardContext: BoardContextState;
}) {
  const platform = usePlatform();
  const [problem, setProblem] = useState<string | null>(null);

  // A platform that has its own chooser is preferred, and not only because a
  // web input opens no panel in the saucer webview: what it hands back knows
  // where it was read from, so one pick resolves the rest of the units by
  // name. The web input can only offer the files themselves.
  const onChooseNatively = async (pick: NonNullable<PlatformCapabilities["pickFiles"]>) => {
    const picked = await pick({ filters: ["*.json", "*.hkpp"], multiple: true });
    if (!picked.length) {
      return;
    }
    const documents = new Map<string, UnitBoard>();
    for (const file of picked) {
      try {
        const data = JSON.parse(file.source);
        if (isBoardDescriptor(data)) {
          documents.set(file.name, data as UnitBoard);
        }
      } catch {
        // Not a board; not one of the units.
      }
    }
    const located = picked.find((file) => file.uri && documents.has(file.name));
    if (!documents.size && !located) {
      setProblem("None of those files is a board.");
      return;
    }
    setProblem(null);
    // Picking any one of the files is enough when the platform said where it
    // is: its neighbours are exactly what the composition names.
    const origin =
      located?.uri && platform.readFile
        ? chainUnitOrigins(
            nativeFileUnitOrigin(located.uri, platform.readFile),
            filesUnitOrigin(documents),
          )
        : filesUnitOrigin(documents);
    await boardContext.setBoardState(board, origin);
  };

  const onChooseInBrowser = () => {
    // Built on the click rather than rendered: a file dialog may only be opened
    // inside the gesture that asked for it.
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".json,.hkpp,application/json";
    input.onchange = async () => {
      const documents = new Map<string, UnitBoard>();
      for (const file of [...(input.files ?? [])]) {
        try {
          const source = await readFile(file, true);
          const data = typeof source === "string" && JSON.parse(source);
          if (data && isBoardDescriptor(data)) {
            documents.set(file.name, data as UnitBoard);
          }
        } catch {
          // A file that is not a board is simply not one of the units.
        }
      }
      if (!documents.size) {
        setProblem("None of those files is a board.");
        return;
      }
      setProblem(null);
      await boardContext.setBoardState(board, filesUnitOrigin(documents));
    };
    input.click();
  };

  const pickFiles = platform.pickFiles;
  const onChoose = () =>
    pickFiles ? void onChooseNatively(pickFiles) : onChooseInBrowser();

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="text-sm text-neutral-500 font-sans">
        This board is made of {missing.length} unit
        {missing.length === 1 ? "" : "s"} that could not be found:{" "}
        {missing.join(", ")}
      </div>
      <div className="flex items-center gap-3">
        <Button className="hkp-svc-btn h-min w-min" onClick={onChoose}>
          Choose the unit files…
        </Button>
        {problem && <span className="text-sm text-red-400">{problem}</span>}
      </div>
    </div>
  );
}
