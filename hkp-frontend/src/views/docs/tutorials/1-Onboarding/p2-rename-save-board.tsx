import Shortcut from "hkp-frontend/src/ui-components/Shortcut";
import MediaParagraph from "../MediaParagraph";
import { leaveLampBoard2 } from "./boards";

export default function RenameSaveBoard() {
  return (
    <MediaParagraph
      title="How to rename and save a Board"
      video="/assets/tutorials/leavelamp-map-2.mp4"
      board={{ name: "LeaveLamp", src: leaveLampBoard2 }}
    >
      When creating a new board as described above, it initially receives a
      random name as a placeholder until you decide to assign it a meaningful
      name. Additionally, the board’s state is not saved automatically; you'll
      need to save it manually by using the board menu or the keyboard shortcut{" "}
      <Shortcut type="command" char="s" />. Let's do this, then reload the page
      to verify that it saved correctly.
    </MediaParagraph>
  );
}
