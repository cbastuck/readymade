import Template from "../../Template";

import { ExampleService, ExampleServiceUI } from "./ExampleService";
import ServiceFrame from "../../../components/ServiceFrame";

export default function ServiceBlock() {
  const service = new ExampleService();
  const serviceUI = (
    <ExampleServiceUI service={service} setup={() => service} />
  );

  return (
    <Template title="Service">
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "row",
        }}
      >
        <div
          style={{
            margin: "30px 5px",
            width: "80%",
            letterSpacing: 1,
            fontSize: 12,
          }}
        >
          Services consist of two components:
          <ul>
            <li>
              one is the main and invisible component of the service
              implementing the logic.
            </li>
            <li>
              The other component is the user interface which allows to
              configure and interact with the service.
            </li>
          </ul>
        </div>
        <div
          style={{
            marginTop: 20,
            marginRight: 30,
            width: 300,
          }}
        >
          <ServiceFrame service={service} serviceUi={serviceUI} />
        </div>
      </div>
    </Template>
  );
}
