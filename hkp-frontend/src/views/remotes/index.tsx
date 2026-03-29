import { useRef } from "react";
import useSWR from "swr";
import { useParams, useNavigate } from "react-router-dom";

import BoardProvider, {
  BoardProviderHandle,
} from "hkp-frontend/src/BoardContext";
import Toolbar from "hkp-frontend/src/components/Toolbar";
import RemotesMenu from "./RemotesMenu";
import { RuntimeClass } from "hkp-frontend/src/types";
import RemoteControl from "./RemoteControl";
import {
  restoreAvailableRuntimeEngines,
  storeAvailableRuntimeEngines,
} from "hkp-frontend/src/common";
import { runtimeApis } from "../playground";

export default function Remotes() {
  const { remote } = useParams();
  const navigate = useNavigate();

  const context = useRef<BoardProviderHandle>(null);
  const availableEngines = restoreAvailableRuntimeEngines() || [];

  const user = null;
  const selectedEngine: RuntimeClass | undefined = remote
    ? availableEngines.find((e) => e.name === remote)
    : undefined;

  const fetcher = () => {
    const api = selectedEngine && runtimeApis[selectedEngine?.type];
    return api && api.attachRuntimes?.(selectedEngine, user);
  };
  const {
    data: state,
    error,
    isLoading,
  } = useSWR(selectedEngine?.url || null, fetcher);

  const onSelectEngine = (engine: RuntimeClass) =>
    navigate(`/remotes/${engine.name}`);

  const onAddRuntimeEngine = (
    desc: RuntimeClass,
    overwriteIfExists: boolean = false
  ) => {
    if (context.current) {
      storeAvailableRuntimeEngines(
        context.current.addAvailableRuntime(desc, overwriteIfExists)
      );
    }
  };

  const onRemoveRuntimeEngine = (desc: RuntimeClass) => {
    if (context.current) {
      storeAvailableRuntimeEngines(
        context.current.removeAvailableRuntime(desc)
      );
    }
  };

  const onUpdateRuntimeEngine = (updated: RuntimeClass) => {
    onAddRuntimeEngine(updated, true);
  };

  if (error) {
    throw new Error("Failed to fetch runtime data");
  }

  if (isLoading) {
    return <p>Loading...</p>;
  }

  return (
    <BoardProvider
      ref={context}
      user={user}
      initialState={state}
      runtimeApis={runtimeApis}
    >
      <div className="w-full h-full bg-neutral-50 flex flex-col">
        <Toolbar>
          <RemotesMenu
            value={selectedEngine}
            availableRuntimeEngines={availableEngines}
            onAddAvailableRuntimeEngine={onAddRuntimeEngine}
            onRemoveAvailableRuntimeEngine={onRemoveRuntimeEngine}
            onUpdateRuntimeEngine={onUpdateRuntimeEngine}
            onSelectEngine={onSelectEngine}
          />
        </Toolbar>
        {selectedEngine ? (
          <RemoteControl runtimeClass={selectedEngine} />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            Select a remote instance
          </div>
        )}
      </div>
    </BoardProvider>
  );
}
