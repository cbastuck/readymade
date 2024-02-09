import { Card, Image } from "semantic-ui-react";

import Template from "../Template";
import { useContext } from "react";
import { AppCtx } from "../../AppContext";

export default function Profile() {
  const context = useContext(AppCtx);
  const user = context?.user;

  return (
    <Template title="profile" isRoot={true}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Card style={{ marginLeft: "auto", marginRight: "auto" }}>
          <Image src={user?.picture} wrapped ui={false} />
          <Card.Content>
            <Card.Header>{user?.username}</Card.Header>
            <Card.Meta>
              <span className="date">{user?.updatedAt}</span>
            </Card.Meta>
            <Card.Description>{user?.userId}</Card.Description>
          </Card.Content>
        </Card>
      </div>
    </Template>
  );
}
