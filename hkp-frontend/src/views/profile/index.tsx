import { useContext } from "react";

import {
  Card,
  CardHeader,
  CardContent,
} from "hkp-frontend/src/ui-components/primitives/card";
import Image from "hkp-frontend/src/ui-components/Image";

import Template from "../Template";
import { AppCtx } from "../../AppContext";

export default function Profile() {
  const context = useContext(AppCtx);
  const user = context?.user;

  return (
    <Template title="Profile" isRoot={true}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Card className="m-auto w-[600px]">
          <CardHeader></CardHeader>
          <CardContent className="text-base mx-4 my-2 p-2">
            <div>
              <Image src={user?.picture} />

              <div>{user?.username}</div>
              <div>
                <span className="date">{user?.updatedAt}</span>
              </div>
              <div>{user?.userId}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Template>
  );
}
