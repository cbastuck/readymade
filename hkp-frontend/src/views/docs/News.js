import React from "react";
import { Link } from "react-router-dom";
import { List } from "semantic-ui-react";

import Template from "./Template";

export default function News() {
  return (
    <Template title="News">
      <List divided relaxed>
        <List.Item>
          <List.Icon size="large" verticalAlign="middle">
            <img
              height={25}
              src="/assets/shutterstock_1196210650.png"
              alt="Hookup"
            />
          </List.Icon>
          <List.Content>
            <List.Header>
              News Section / Fix{" "}
              <Link to="/service/trigger-pad">TriggerPad</Link> for touch
              devices
            </List.Header>
            <List.Description>24.2.2022</List.Description>
          </List.Content>
        </List.Item>
      </List>
    </Template>
  );
}
