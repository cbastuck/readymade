import { Icon, Menu } from "semantic-ui-react";

import { RuntimeDescriptor } from "@/types";
import { useContext } from "react";
import { BoardCtx } from "@/BoardContext";

type Props = {
  expanded?: boolean;
  showSettings?: boolean;
  wrapServices?: boolean;
  disabledItems?: Array<string>;
  runtime: RuntimeDescriptor;
  onAction: (actionId: string) => void;
};
export default function Settings({
  runtime,
  expanded,
  showSettings,
  wrapServices,
  disabledItems,
  onAction,
}: Props) {
  const boardContext = useContext(BoardCtx);
  const { services: allServices = {} } = boardContext || {};
  const services = allServices[runtime.id];
  const itemStyle = {
    height: 40,
    margin: 0,
  };
  return (
    <Menu vertical compact style={{ height: "100%" }}>
      <Menu.Item
        as="a"
        style={itemStyle}
        onClick={() => {
          if (boardContext) {
            services.length === 0
              ? boardContext.removeRuntime(runtime)
              : boardContext.removeAllServices(runtime);
          }
        }}
        disabled={disabledItems?.indexOf("remove") !== -1}
      >
        <Icon
          name={
            !services || services.length === 0
              ? "trash alternate outline"
              : "remove"
          }
        />
      </Menu.Item>
      {
        <Menu.Item
          as="a"
          style={itemStyle}
          onClick={() =>
            this.setState({
              expanded: !expanded,
              showSettings: showSettings && !expanded,
            })
          }
        >
          <Icon name="compress" />
        </Menu.Item>
      }
      <Menu.Item
        as="a"
        style={itemStyle}
        onClick={() => this.setState({ wrapServices: !wrapServices })}
      >
        <Icon name={wrapServices ? "exchange" : "sort amount down"} />
      </Menu.Item>
    </Menu>
  );
}
