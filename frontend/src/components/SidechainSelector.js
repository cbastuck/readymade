import React, { Component } from 'react';
import { 
  Button, 
  Table, 
  Checkbox, 
} from 'semantic-ui-react';

import { s, t } from '../styles';

export default class SidechainSelector extends Component {
  renderTable = (runtimes, services, routing, onSelect) => {
    return (
      <Table definition>
        <Table.Body>
        { 
          runtimes.map(
            runtime => (
              <Table.Row key={`sidechain-row-${runtime.id}`}>
                <Table.Cell>{runtime.name}</Table.Cell>
                { 
                  services[runtime.id].map(service => {
                    return (
                      <Table.Cell key={`sidechain-col-${service.uuid}`}> 
                        <Checkbox
                          toggle
                          style={t.fs11 }
                          label={service.serviceName}
                          onChange={(_, { checked }) => {
                            const selection = checked ?
                              routing.concat({ 
                                runtimeId: runtime.id, 
                                serviceUuid: service.uuid 
                              }) :
                              routing.filter(r => 
                                r.runtimeId !== runtime.id && 
                                r.serviceUuid !== service.uuid
                              );
                            onSelect(selection);
                          }}
                          checked={
                            !!routing.find(r => 
                              r.runtimeId === runtime.id && 
                              r.serviceUuid === service.uuid
                            )
                          }
                        />
                      </Table.Cell>
                    );
                  })
                }
              </Table.Row>
            )
          ) 
        }
        </Table.Body>
      </Table>
    );
  }
  render() {
    const { 
      onClose,
      services,
      runtimes,
      routing,
      onSelect,
    } = this.props;
    return (
      <div
        style={
          s(t.uc, t.fs12, t.ls1, {
            height: 250,
            border: 'solid 1px lightgray',
            borderRadius: 3,
            backgroundColor: '#EEEEEE10',
            padding: 20,
          })
        }
      >
        <div>
          Route the output of this runtime to <span style={{ textStyle: 'italic' }}>configure</span> services from these runtimes:
        </div>
        { this.renderTable(runtimes, services, routing || [], onSelect) }
        <Button 
          onClick={onClose}
          style={s(t.uc, t.fs12, t.ls1)}
        >
          Close
        </Button>
      </div>
    );
  }
}