import React, { useEffect, useState } from "react";
import { Loader } from "semantic-ui-react";

import BoardCollection from "../../components/BoardCollection";
import { replacePlaceholders } from "../../core/url";
import { generateRandomName } from "../../core/board";
import { t } from "../../styles";

//const usecasesUrl = 'https://raw.githubusercontent.com/cbastuck/hkp/master/usecases/index.json';
const usecasesUrl = "/boards/usecases/index.json";

const internalUsecases = [
  /*{
      name: 'GameInternal',
      url: `/playground/${generateRandomName()}?template=/boards/templates/game.json&${qs.stringify({ 'sender-board': generateRandomName() })}`,
      metadata: 'use case',
      description: 'GAMEMEME'
    }*/
];

async function retrieveUsecases() {
  const resp = await fetch(usecasesUrl);
  const usecases = await resp.json();
  return internalUsecases.concat(
    usecases.map((item) => ({
      ...item,
      url: replacePlaceholders(
        `/playground/${generateRandomName()}?template=${item.template}`
      ),
      metadata: "use case",
      repo: item.repo,
    }))
  );
}

export default function Usecases() {
  const [usecases, setUsecases] = useState(undefined);
  useEffect(() => retrieveUsecases().then(setUsecases), []);
  return (
    <div style={t.tc}>
      {usecases ? (
        <BoardCollection
          style={{
            width: "100%",
            marginRight: 20,
          }}
          headline="Available Showcases"
          items={usecases}
          renderBorder={false}
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
