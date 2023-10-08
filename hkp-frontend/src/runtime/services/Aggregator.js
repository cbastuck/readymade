import React, { Component } from "react";

import InputField from "../../components/shared/InputField";
import SelectorField from "../../components/shared/SelectorField";

import ServiceUI from "./ServiceUI";

const serviceId = "hookup.to/service/aggregator";
const serviceName = "Aggregator";

export class AggregatorUI extends Component {
  state = {
    interval: 0,
    property: "",
    aggregator: "",
  };

  onInit = (initialState) => {
    this.setState({
      interval: initialState.interval || 100,
      property: initialState.property || "",
      aggregator: initialState.aggregator || "val_max_occ",
    });
  };

  onNotification = async (service, notification) => {};

  renderMain = (service) => {
    const { interval, property, aggregator } = this.state;
    const aggOptions = {
      val_max_occ: "max value count",
    };
    return (
      <div style={{ overflow: "auto" }}>
        <InputField
          type="text"
          label="Property"
          value={property}
          onChange={async (_, { value: property }) => {
            await service.configure({ property });
            this.setState({ property });
          }}
        />
        <SelectorField
          label="aggregator"
          options={aggOptions}
          value={aggregator}
          onChange={async (_ev, { value: aggregator }) => {
            await service.configure({ aggregator });
            this.setState({ aggregator });
          }}
        />
        <InputField
          type="number"
          label="Interval"
          value={interval}
          unit="ms"
          onChange={async (_, { value }) => {
            await service.configure({ interval: value });
            this.setState({ interval: value });
          }}
        />
      </div>
    );
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit}
        onNotification={this.onNotification}
        segments={[{ name: "main", render: this.renderMain }]}
      />
    );
  }
}

class Aggregator {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.interval = 100;
    this.property = "unset";
    this.aggregate = {};
  }

  configure(config) {
    const { interval, property } = config;

    if (interval !== undefined) {
      this.interval = interval;
      this.reset();
      this.app.notify(this, { interval });
    }

    if (property !== undefined) {
      this.property = property;
      this.app.notify(this, { property });
    }
  }

  destroy = () => {
    this.destroyTimer();
  };

  destroyTimer = () => {
    if (this.__timer) {
      clearInterval(this.__timer);
    }
  };

  reset = () => {
    this.destroyTimer();
    this.__timer = setInterval(this.doSubmit, this.interval);
  };

  doAggregate = (params) => {
    for (const key of Object.keys(params)) {
      const value = params[key];
      if (value === null) {
        return;
      }
      if (!this.aggregate[key]) {
        this.aggregate[key] = { [value]: 1 };
      } else {
        const aggValues = this.aggregate[key];
        if (aggValues[value] !== undefined) {
          ++aggValues[value];
        } else {
          aggValues[value] = 1;
        }
      }
    }
  };

  doSubmit = () => {
    const aggregate = this.aggregate[this.property];
    if (aggregate) {
      const keys = Object.keys(aggregate);
      const firstKey = keys[0];
      if (firstKey) {
        const winner = keys.reduce(
          (max, curKey) => {
            const curValue = aggregate[curKey];
            return max.value < curValue
              ? { key: curKey, value: curValue }
              : max;
          },
          {
            key: firstKey,
            value: this.aggregate[this.property][firstKey],
          }
        );
        const nextParams = {
          [this.property]: winner.key,
        };
        this.app.next(this, nextParams);
      }
    }
    this.aggregate = {};
  };

  async process(params) {
    if (Array.isArray(params)) {
      params.forEach(this.doAggregate);
    } else {
      this.doAggregate(params);
    }
    return null;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Aggregator(app, board, descriptor, id),
  createUI: AggregatorUI,
};

export default descriptor;
