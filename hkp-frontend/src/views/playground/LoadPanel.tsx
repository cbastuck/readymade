import { useEffect, useState } from "react";

import { localStoragePrefix, getLocalBoards } from "./common";

import { SavedBoard } from "../../types";
import Search from "@/components/BoardCollection/Search";
import BoardTable from "@/ui-components/BoardTable";

export default function LoadPanel() {
  const [filter, setFilter] = useState("");
  const [savedBoards, setSavedBoards] = useState<Array<SavedBoard>>([]);
  useEffect(() => setSavedBoards(getLocalBoards(localStoragePrefix)), []);

  if (!savedBoards || savedBoards.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex items-center">
        <h2>Local Boards</h2>
        <div className="ml-auto">
          <Search
            filter={filter}
            onChange={(newFilter) => setFilter(newFilter)}
          />
        </div>
      </div>

      <BoardTable boards={savedBoards} className="h-[300px] border" />
    </div>
  );
}
