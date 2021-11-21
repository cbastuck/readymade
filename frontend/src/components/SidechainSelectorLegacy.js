import React, { Component } from "react";
import { Table, Checkbox } from "semantic-ui-react";

import { s, t } from "../styles";

export default class SidechainSelectorLegacy extends Component {
  renderTable = (runtimes, services, routing, onSelect) => {
    if (!services || !runtimes) {
      return false;
    }
    return (
      <Table definition>
        <Table.Body>
          {runtimes.map((runtime) => (
            <Table.Row key={`sidechain-row-${runtime.id}`}>
              <Table.Cell>{runtime.name}</Table.Cell>
              {services[runtime.id] &&
                services[runtime.id].map((service) => {
                  return (
                    <Table.Cell key={`sidechain-col-${service.uuid}`}>
                      <Checkbox
                        toggle
                        style={t.fs11}
                        label={service.serviceName}
                        onChange={(_, { checked }) => {
                          const selection = checked
                            ? routing.concat({
                                runtimeId: runtime.id,
                                serviceUuid: service.uuid,
                              })
                            : routing.filter(
                                (r) =>
                                  r.runtimeId !== runtime.id &&
                                  r.serviceUuid !== service.uuid
                              );
                          onSelect(selection);
                        }}
                        checked={
                          !!routing.find(
                            (r) =>
                              r.runtimeId === runtime.id &&
                              r.serviceUuid === service.uuid
                          )
                        }
                      />
                    </Table.Cell>
                  );
                })}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    );
  };
  render() {
    const { services, runtimes, routing, onSelect } = this.props;
    return (
      <div
        style={s(t.uc, t.fs12, t.ls1, {
          borderRadius: 3,
          backgroundColor: "#EEEEEE10",
          padding: "5px 0px",
        })}
      >
        <div style={{ display: "flex", flexDirection: "row" }}>
          <div style={s(t.fs11, t.bold, { paddingTop: 5 })}>
            Route the output of this runtime to{" "}
            <span style={{ textStyle: "italic" }}>configure</span> some of the
            following services:
          </div>
        </div>
        {this.renderTable(runtimes, services, routing || [], onSelect)}
      </div>
    );
  }
}
