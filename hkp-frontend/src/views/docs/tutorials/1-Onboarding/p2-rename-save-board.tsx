import Shortcut from "@/ui-components/Shortcut";
import MediaParagraph from "../MediaParagraph";
import { leaveLampBoard2 } from "./boards";

export default function RenameSaveBoard() {
  return (
    <MediaParagraph
      title="How to rename and save a Board"
      video="/assets/tutorials/leavelamp-map-2.mp4"
      board={{ name: "LeaveLamp", src: leaveLampBoard2 }}
    >
      When creating a new board as shown above, the created board gets a random
      name. This name serves as a placeholder until you feel like assigning a
      meaningful name. Further, the state of a board is not automatically saved.
      You need to save by using the board menu or the keyboard shortcut{" "}
      <Shortcut type="command" char="s" />. Let's do this and reload the page
      afterwards to verify it worked.
    </MediaParagraph>
  );
}
