import { Button, Card, Image, Input } from "semantic-ui-react";

import Template from "../Template";
import { useContext, useState } from "react";
import { AppCtx } from "../../AppContext";
import { hashString } from "../../common";

type Props = {};

function formatDate(date: Date) {
  return `${date.getFullYear()}${
    date.getMonth() + 1
  }${date.getDate()}-${date.getHours()}${date.getMinutes()}`;
}

export default function Profile(props: Props) {
  const context = useContext(AppCtx);
  const user = context?.user;

  const [val, setVal] = useState("RummyCup");

  const onClick = async () => {
    const message = {
      type: "document",
      resourceId: `test-${formatDate(new Date())}`,
      data: {
        gambler: "cba",
        amount: Math.random() * 5,
        game: val,
      },
    };
    const messageHash = await hashString(JSON.stringify(message));
    const groupId = "boardName";
    const payload: any = {
      QueueUrl:
        "https://sqs.eu-central-1.amazonaws.com/000000000000/hkp-sqs.fifo",
      MessageBody: message,
      MessageGroupId: groupId,
      MessageDeduplicationId: messageHash,
    };

    const resp = await fetch(
      "https://redacted.execute-api.eu-central-1.amazonaws.com/state/someid",
      {
        method: "put",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${user?.idToken}`,
        },
        body: JSON.stringify(payload),
      }
    );
    console.log("RESPOSE", await resp.text());
  };

  return (
    <Template title="profile" isRoot={true}>
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
      <div style={{ width: "100%", textAlign: "center", marginTop: 20 }}>
        <Input value={val} onChange={(ev, { value }) => setVal(value)} />
        <Button onClick={onClick}>Click</Button>
      </div>
    </Template>
  );
}
