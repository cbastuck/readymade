import React, { useEffect, useState } from "react";
import { Loader } from "semantic-ui-react";

import BoardCollection from "../../components/BoardCollection";
import { t } from "../../styles";

const usecasesUrl = "/boards/usecases/index.json";

const internalUsecases = [
  /*{
    name: "GameInternal",
    url: `/playground/${generateRandomName()}?template=/boards/templates/game.json&sender-board=${generateRandomName()}`,
    metadata: "showcase",
    description: "GAMEMEME",
  }*/
];

async function retrieveUsecases() {
  const resp = await fetch(usecasesUrl);
  const usecases = await resp.json();
  return internalUsecases.concat(
    usecases.map((item) => ({
      ...item,
      url: `/playground?template=${item.template}&sender-board=%random-name%`,
      metadata: "showcase",
      repo: item.repo,
    }))
  );
}

export default function Usecases({
  headline = "Available Showcases",
  renderSearch = true,
}) {
  const [usecases, setUsecases] = useState(undefined);
  useEffect(() => retrieveUsecases().then(setUsecases), []);
  return (
    <div style={(t.tc, t.uc)}>
      {usecases ? (
        <BoardCollection
          style={{
            width: "100%",
            marginRight: 20,
          }}
          headline={headline}
          items={usecases}
          renderBorder={false}
          renderSearch={renderSearch}
        />
      ) : (
        <div>
          <Loader active inline>
            Loading Showcases ...
          </Loader>
        </div>
      )}
    </div>
  );
}
