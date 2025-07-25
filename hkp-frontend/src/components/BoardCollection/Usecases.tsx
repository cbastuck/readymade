import { useEffect, useState } from "react";
import LoadIndicator from "hkp-frontend/src/views/playground/LoadIndicator";

import BoardCollection from ".";
import { UsecaseDescriptor } from "../../types";
import { s, t } from "../../styles";

const usecasesUrl = "/boards/usecases/index.json";

export default function Usecases({
  headline = "Available Showcases",
  renderSearch = true,
}) {
  const [usecases, setUsecases] = useState<Array<UsecaseDescriptor>>();
  useEffect(() => {
    retrieveUsecases().then(setUsecases);
  }, []);
  return (
    <div style={s(t.fill, t.tc)}>
      {usecases ? (
        <BoardCollection
          headline={headline}
          items={usecases}
          renderBorder={false}
          renderSearch={renderSearch}
        />
      ) : (
        <LoadIndicator text="Loading ... " />
      )}
    </div>
  );
}

const internalUsecases: Array<UsecaseDescriptor> = [
  /*{
    name: "GameInternal",
    url: `/playground/${generateRandomName()}?template=/boards/templates/game.json&sender-board=${generateRandomName()}`,
    metadata: "showcase",
    description: "GAMEMEME",
  }*/
];

async function retrieveUsecases(): Promise<Array<UsecaseDescriptor>> {
  const resp = await fetch(usecasesUrl);
  const usecases: Array<UsecaseDescriptor> = await resp.json();
  return internalUsecases.concat(
    usecases.map((item) => ({
      ...item,
      url: `/playground?template=${item.template}&sender-board=%random-name%`,
      metadata: "showcase",
      repo: item.repo,
    }))
  );
}
