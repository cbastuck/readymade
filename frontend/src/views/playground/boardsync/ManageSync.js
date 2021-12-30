import React from "react";
import { Button, Checkbox, Table } from "semantic-ui-react";

import { s, t } from "../../../styles";

export default function ManageSync({
  acceptedSenders: accepted,
  rejectedSenders: rejected,
  onAccept,
  onReject,
}) {
  const sorted = [...accepted, ...rejected].sort();
  return (
    <div
      style={s(t.borderCol("lightgray"), {
        borderTop: "none",
        borderRadius: 5,
        marginTop: 3,
      })}
    >
      <Table compact celled definition style={t.text}>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell />
            <Table.HeaderCell style={s(t.text, t.normal)}>
              Board Name
            </Table.HeaderCell>
            <Table.HeaderCell style={s(t.text, t.normal)}>
              Request Date
            </Table.HeaderCell>
            <Table.HeaderCell style={s(t.text, t.normal)}>
              Email address
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {sorted.map((sender) => (
            <Table.Row key={`sync-mgmt-sender-${sender}`}>
              <Table.Cell collapsing>
                <Checkbox
                  toggle
                  checked={accepted.indexOf(sender) !== -1}
                  onChange={(_, { checked }) =>
                    checked ? onAccept(sender) : onReject(sender)
                  }
                />
              </Table.Cell>
              <Table.Cell>{sender}</Table.Cell>
              <Table.Cell>September 14, 2021</Table.Cell>
              <Table.Cell>{sender}@email.com</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>

        <Table.Footer fullWidth>
          <Table.Row>
            <Table.HeaderCell />
            <Table.HeaderCell colSpan="4">
              <Button
                size="small"
                style={t.text}
                onClick={() => onReject(accepted)}
                disabled={accepted.length === 0}
              >
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
