import React from "react";
import { Dropdown } from "semantic-ui-react";

export default function SidechainSelector({ boardContext, values, onChange }) {
  const flatServices = boardContext.runtimes.reduce(
    (all, rt) => [
      ...all,
      ...boardContext.services[rt.id].map((svc) => ({ rt, svc })),
    ],
    []
  );

  const options = flatServices.map(({ rt, svc }) => ({
    key: `${rt.id}.${svc.uuid}`,
    text: `${rt.name}-${svc.serviceName}`,
    value: `${rt.id}.${svc.uuid}`,
  }));

  const mappedValues = values.map(
    (item) => `${item.runtimeId}.${item.serviceUuid}`
  );
  return (
    <Dropdown
      style={{ width: "100%" }}
      placeholder="Targets"
      fluid
      multiple
      selection
      options={options}
      onChange={(ev, { value }) => {
        const unmappedValues = value.map((item) => {
          const pair = item.split(".");
          return { runtimeId: pair[0], serviceUuid: pair[1] };
        });
        onChange(unmappedValues);
      }}
      value={mappedValues}
    />
  );
}
