import { Link } from "react-router-dom";
import { List } from "semantic-ui-react";

import NewsItem from "./NewsItem";

import Template from "../../Template";

export default function Updates() {
  return (
    <Template title="What's new">
      <List divided relaxed style={{ marginTop: "40px" }}>
        <NewsItem
          date="5.2.2024"
          content={<div>Introduced typewriter style</div>}
        />
        <NewsItem
          date="7.1.2024"
          content={<div>Major overhaul and support for remote runtimes</div>}
        />
        <NewsItem
          date="30.10.2022"
          content={
            <div>
              <div>
                <Link to="/docs/tracks/bridge">Bridge </Link>
                <div>
                  Use a Google spreadsheet as content provider for a simple{" "}
                  <a
                    href={`${window.location.protocol}//bridge.${window.location.hostname}/`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    example
                  </a>{" "}
                  demonstrating the Bridge API.
                </div>
              </div>
            </div>
          }
        />
        <NewsItem
          date="24.7.2022"
          content={
            <div>
              <div>
                <Link to="/docs/proto/Spotty"> Spotty</Link>
                <div>
                  An early, unplublished, internal prototype. Still, a good
                  example for hooking up with external services.
                </div>
              </div>
              <div>
                Added <Link to="/docs/tracks/brand"> single dot symbol</Link> as
                favicon and smallest logo version.
              </div>
            </div>
          }
        />
        <NewsItem
          date="25.6.2022"
          content={
            <div>
              <Link to="/docs"> Documentation</Link>,{" "}
              <Link to="/docs/tracks/brand">Brand</Link> side-track and merge
              <Link to="/examples"> Examples </Link> with showcases
            </div>
          }
        />
        <NewsItem
          date="24.6.2022"
          content={
            <div>
              <Link to="/docs/pitch/what"> What - Why - How </Link> of Hookup
            </div>
          }
        />
        <NewsItem
          date="24.2.2022"
          content={
            <div>
              Updates Section / Fix{" "}
              <Link to="/service/trigger-pad">TriggerPad</Link> for touch
              devices
            </div>
          }
        />
      </List>
    </Template>
  );
}
