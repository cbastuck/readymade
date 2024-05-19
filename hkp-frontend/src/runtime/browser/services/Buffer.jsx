import { Component } from "react";
import { List } from "semantic-ui-react";

import BufferDescriptor from "hkp-services/Buffer";
import InputField from "hkp-frontend/src/components/shared/InputField";
import Button from "hkp-frontend/src/ui-components/Button";
import { s, t } from "hkp-frontend/src/styles";

import ServiceUI from "hkp-frontend/src/runtime/services/ServiceUI";

export class BufferUI extends Component {
  state = {
    capacity: 0,
    items: [],
  };

  onInit = (initialState) => {
    const { capacity } = initialState;
    this.setState({
      capacity,
    });
  };

  onNotification = async (notification) => {
    const items = await service.configure({ action: "getBuffer" });
    this.setState({ items });
  };

  renderBuffer = (service) => {
    const { items } = this.state;
    return (
      <List style={s(t.fill)} verticalAlign="middle" divided>
        {items.map((item, idx) => (
          <List.Item key={`buffer-list-item-${idx}`}>
            <List.Content>{JSON.stringify(item)}</List.Content>
          </List.Item>
        ))}
      </List>
    );
  };

  renderMain = (service) => {
    return (
      <div>
        <InputField
          type="number"
          value={this.state.capacity}
          onChange={(_, { value }) => {
            const capacity = value !== "" && Number(value);
            service.configure({ capacity });
            this.setState({ capacity });
          }}
          label="Capacity"
          unit="items"
        />
        <Button
          style={s(t.w100, t.mt5, t.ls1, t.fs12)}
          onClick={() => (service.buffer = [])}
        >
          Clear
        </Button>
      </div>
    );
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit}
        onNotification={this.onNotification}
        segments={[
          { name: "main", render: this.renderMain },
          { name: "buffer", render: this.renderBuffer },
        ]}
      />
    );
  }
}

const descriptor = {
  serviceName: BufferDescriptor.serviceName,
  serviceId: BufferDescriptor.serviceId,
  create: (app, board, descriptor, id) =>
    new BufferDescriptor.Buffer(app, board, descriptor, id),
  createUI: BufferUI,
};

export default descriptor;
