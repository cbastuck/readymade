import React from "react";
import { Link } from "react-router-dom";
import { List, Icon } from "semantic-ui-react";

import Template from "../Template";

export default function Updates() {
  return (
    <Template title="What's new">
      <List divided relaxed>
        <NewsItem
          date="25.8.2022"
          content={
            <div>
              <div>
                <Link to="/docs/tracks/bridge"> The Bridge </Link>
                <div>
                  Integrate board into external html documents, like in this{" "}
                  <a href="/bridge.html" target="_blank">
                    Example
                  </a>
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

function NewsItem({ content, date }) {
  return (
    <List.Item style={{ margin: "5px 0px" }}>
      <List.Icon size="large" verticalAlign="middle">
        <Icon name="circle outline" size="small" />
      </List.Icon>
      <List.Content>
        <List.Header>{content}</List.Header>
        <List.Description>{date}</List.Description>
      </List.Content>
    </List.Item>
  );
}
