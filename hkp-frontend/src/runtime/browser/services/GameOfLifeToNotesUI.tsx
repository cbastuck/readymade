import { useState } from "react";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";

export default function GameOfLifeToNotesUI(props: ServiceUIProps) {
  const { service } = props;
  const [maxNotes, setMaxNotes] = useState(6);
  const [noteCount, setNoteCount] = useState(0);

  return (
    <ServiceUI
      {...props}
      onInit={(state: any) => {
        if (state.maxNotes !== undefined) setMaxNotes(state.maxNotes);
      }}
      onNotification={(n: any) => {
        if (n.maxNotes !== undefined) setMaxNotes(n.maxNotes);
        if (n.noteCount !== undefined) setNoteCount(n.noteCount);
      }}
    >
      <div style={{ padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
        <div>Notes/frame: {noteCount}</div>
        <div style={{ marginTop: 4 }}>
          Max notes:{" "}
          <input
            type="number"
            value={maxNotes}
            min={1}
            max={12}
            style={{ width: 40 }}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMaxNotes(v);
              service.configure({ maxNotes: v });
            }}
          />
        </div>
      </div>
    </ServiceUI>
  );
}
