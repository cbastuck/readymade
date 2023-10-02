import { Dropdown, DropdownProps } from "semantic-ui-react";
import { BoardContextState } from "../../BoardContext";
import {
  RuntimeDescriptor,
  ServiceDescriptor,
  SidechainRoute,
} from "../../types";

type FlatServices = {
  rt: RuntimeDescriptor;
  svc: ServiceDescriptor;
};

type Props = {
  boardContext: BoardContextState;
  values: Array<SidechainRoute>;
  onChange: (value: Array<SidechainRoute>) => void;
};

export default function SidechainSelector({
  boardContext,
  values,
  onChange,
}: Props) {
  const flatServices = boardContext.runtimes.reduce<Array<FlatServices>>(
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
      onChange={(ev, { value }: DropdownProps) => {
        if (Array.isArray(value)) {
          const unmappedValues = (value as string[]).map((item) => {
            const pair = item.split(".");
            return { runtimeId: pair[0], serviceUuid: pair[1] };
          });
          onChange(unmappedValues);
        }
      }}
      value={mappedValues}
    />
  );
}
