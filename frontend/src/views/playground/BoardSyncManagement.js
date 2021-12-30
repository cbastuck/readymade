import React from "react";
import { Button, Checkbox, Table } from "semantic-ui-react";

import { s, t } from "../../styles";

export default function BoardSyncManagement() {
  return (
    <div
      style={s(t.borderCol("lightgray"), {
        borderTop: "none",
        marginTop: 3,
      })}
    >
      <Table style={s(t.text)} compact celled definition>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell />
            <Table.HeaderCell style={t.text}>Board Name</Table.HeaderCell>
            <Table.HeaderCell style={t.text}>Request Date</Table.HeaderCell>
            <Table.HeaderCell style={t.text}>Email address</Table.HeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          <Table.Row>
            <Table.Cell collapsing>
              <Checkbox slider />
            </Table.Cell>
            <Table.Cell>John Lilki</Table.Cell>
            <Table.Cell>September 14, 2013</Table.Cell>
            <Table.Cell>someone@example.com</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell collapsing>
              <Checkbox slider />
            </Table.Cell>
            <Table.Cell>Jamie Harington</Table.Cell>
            <Table.Cell>January 11, 2014</Table.Cell>
            <Table.Cell>someone@example.com</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell collapsing>
              <Checkbox slider />
            </Table.Cell>
            <Table.Cell>Jill Lewis</Table.Cell>
            <Table.Cell>May 11, 2014</Table.Cell>
            <Table.Cell>someone@example.com</Table.Cell>
          </Table.Row>
        </Table.Body>

        <Table.Footer fullWidth>
          <Table.Row>
            <Table.HeaderCell />
            <Table.HeaderCell colSpan="4">
              <Button size="small" style={t.text}>
                Reject All
              </Button>
              <Button disabled size="small" style={t.text}>
                Add user
              </Button>
            </Table.HeaderCell>
          </Table.Row>
        </Table.Footer>
      </Table>
    </div>
  );
}
