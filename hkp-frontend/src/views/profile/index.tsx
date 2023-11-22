import { useAuth0 } from "@auth0/auth0-react";
import { Card, Image } from "semantic-ui-react";

import Template from "../Template";

type Props = {};

export default function Profile(props: Props) {
  const { user } = useAuth0();
  return (
    <Template title="profile" isRoot={true}>
      <Card style={{ marginLeft: "auto", marginRight: "auto" }}>
        <Image src={user?.picture} wrapped ui={false} />
        <Card.Content>
          <Card.Header>{user?.name}</Card.Header>
          <Card.Meta>
            <span className="date">{user?.updated_at}</span>
          </Card.Meta>
          <Card.Description>{user?.sub}</Card.Description>
        </Card.Content>
      </Card>
    </Template>
  );
}
