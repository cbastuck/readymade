import React, { Component } from "react";
import { Line, Doughnut, Bar } from "react-chartjs-2";

import { isObject } from "./helpers";
import SelectorField from "../../components/shared/SelectorField";
import ServiceUI from "./ServiceUI";
import { s, t } from "../../styles";
import { p } from "./colorpalette";

const serviceId = "hookup.to/service/chart";
const serviceName = "Chart";

function firstKey(x) {
  return Object.keys(x)[0];
}

function elementBehindFirstKey(x) {
  return x[firstKey(x)];
}

function reduce(obj, selector) {
  return Object.keys(obj)
    .filter((key) => !selector || key === selector)
    .reduce((acc, key) => {
      const value = obj[key];
      const n = isObject(value)
        ? reduce(value) // TODO: apply selector on first level only
        : Number(value);
      return acc + n;
    }, 0);
}

function createColor(idx) {
  const ci = idx % p.length;
  return `#${p[ci]}`;
}

const defaultChartStyle = {
  fill: false,
  lineTension: 0.1,
  backgroundColor: "rgba(75,192,192,0.4)",
  borderColor: "rgba(75,192,192,1)",
  borderCapStyle: "butt",
  borderDash: [],
  borderDashOffset: 0.0,
  borderJoinStyle: "miter",
  pointBorderColor: "rgba(75,192,192,1)",
  pointBackgroundColor: "#fff",
  pointBorderWidth: 1,
  pointHoverRadius: 5,
  pointHoverBackgroundColor: "rgba(75,192,192,1)",
  pointHoverBorderColor: "rgba(220,220,220,1)",
  pointHoverBorderWidth: 2,
  pointRadius: 1,
  pointHitRadius: 10,
};

class ChartUI extends Component {
  state = {
    graphType: "line",
    selector: "*",
    data: {
      labels: [],
      datasets: [],
    },
  };

  onInit = (initialConfig) => {
    const { selector = "*" } = initialConfig;
    this.setState({ selector });
  };

  onNotification = (service, notification) => {
    const { data, selector } = notification;

    if (selector !== undefined) {
      this.setState({ selector });
    }

    if (data !== undefined) {
      const { labels, values } = data;
      this.updateData(labels, values, selector || this.state.selector);
    }
  };

  updateData = (labels, values, selector) => {
    const firstValueKeys = Object.keys(values[0] || {});
    const selectorOptions = firstValueKeys.reduce(
      (acc, cur) => ({ ...acc, [cur]: cur }),
      {}
    );

    this.setState({
      labels,
      values,
      selectorOptions,
    });
  };

  renderLine = (service) => {
    const { labels, values, selector } = this.state;
    if (!labels || !values) {
      return false;
    }
    const data = values.map((val) => reduce(val, selector));
    return (
      <Line
        options={{ legend: { display: false } }}
        data={{
          labels,
          datasets: [
            {
              ...defaultChartStyle,
              data,
            },
          ],
        }}
        onElementsClick={(elems) => {
          const elem = elems[0];
          if (elem) {
            const clickedKey = labels[elem._index];
            const clickedValue = values[elem._index];
            service.app.next(service, { [clickedKey]: clickedValue }); // TODO: not here
          }
        }}
      />
    );
  };

  renderDoughnut = (service) => {
    const { labels: rl, values: rv, selector } = this.state;
    const labels = rv.length === 1 ? Object.keys(rv[0][selector]) : rl;

    const values =
      rv.length === 1
        ? Object.keys(rv[0][selector]).map((k) => rv[0][selector][k])
        : rv.map((v) => reduce(v, selector));

    return (
      <Doughnut
        options={{
          legend: {
            display: labels.length < 7,
          },
        }}
        data={{
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: values.map((_, idx) => createColor(idx)),
            },
          ],
        }}
      />
    );
  };

  renderStackedBar = (service) => {
    const { labels = [], values = [], selector } = this.state;

    const selectedValues = values.map((val) => val[selector]);
    const distinctValues = selectedValues.reduce((all, cur) => {
      const newKeys = Object.keys(cur).filter((k) => all.indexOf(k) === -1);
      return [...all, ...newKeys];
    }, []);
    const datasets = distinctValues.map((distinctValue, di) => ({
      label: distinctValue,
      data: values.map((value) => value[selector][distinctValue] || 0),
      backgroundColor: createColor(di),
    }));

    return (
      <Bar
        onElementsClick={(elems) => {
          if (elems && elems[0]) {
            const idx = elems[0]._index;
            service.inject({ [labels[idx]]: values[idx] }); // TODO
          }
        }}
        options={{
          scales: {
            xAxes: [{ stacked: true }],
            yAxes: [{ stacked: true }],
          },
          legend: {
            display: distinctValues.length < 10,
          },
        }}
        data={{
          labels,
          datasets,
        }}
      />
    );
  };

  renderMain = (service) => {
    const {
      labels = [],
      values = [],
      selector,
      selectorOptions,
      graphType,
    } = this.state;
    return (
      <div style={s(t.fill, { minWidth: 400, minHeight: 250 })}>
        <SelectorField
          label="Select"
          options={selectorOptions}
          value={selector}
          onChange={(ev, { value: selector }) => {
            this.setState({ selector }, () =>
              this.updateData(labels, values, selector)
            );
          }}
        />
        <SelectorField
          style={t.mb5}
          label="Type"
          options={{
            line: "line",
            pie: "pie",
            bar: "bar",
          }}
          value={graphType}
          onChange={(ev, { value: graphType }) => {
            this.setState({ graphType });
          }}
        />
        {graphType === "line" && this.renderLine(service)}
        {graphType === "pie" && this.renderDoughnut(service)}
        {graphType === "bar" && this.renderStackedBar(service)}
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

class Chart {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.selector = undefined;
  }

  configure(config) {}

  inject(params) {
    this.app.next(this, params);
  }

  deduceSelector(params) {
    const firstElement = Array.isArray(params)
      ? params[0]
      : elementBehindFirstKey(params); // element behind first reduced key
    const firstElementKeys = firstElement && Object.keys(firstElement);
    const selector = firstElementKeys && firstElementKeys[0];
    if (selector) {
      this.selector = selector;
      this.app.notify(this, { selector });
    }
  }

  process(params) {
    if (!this.selector) {
      this.deduceSelector(params);
    }
    if (this.selector) {
      if (Array.isArray(params)) {
        const labels = params.map((param) => firstKey(param));
        const values = params.map(
          (param) => param[firstKey(param)][this.selector]
        );
        this.app.notify(this, { data: { labels, values } });
      } else {
        const labels = Object.keys(params);
        const values = labels.map((key) => params[key]);
        this.app.notify(this, { data: { labels, values } });
      }
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) => new Chart(app, board, descriptor, id),
  createUI: ChartUI,
};

export default descriptor;
