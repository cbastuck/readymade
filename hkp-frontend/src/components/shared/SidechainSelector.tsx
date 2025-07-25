import { BoardContextState } from "../../BoardContext";
import {
  RuntimeDescriptor,
  ServiceDescriptor,
  SidechainRoute,
} from "../../types";
import MultipleSelector, {
  Option,
} from "hkp-frontend/src/ui-components/MultiSelect";

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
    label: `${rt.name}-${svc.serviceName}`,
    value: `${rt.id}.${svc.uuid}`,
  }));

  const mappedValues = values.flatMap((value) => {
    const v = `${value.runtimeId}.${value.serviceUuid}`;
    const opt = options.find((option) => option.value === v);
    if (!opt) {
      return [];
    }
    return [opt];
  });

  const onChangeSelector = (newValues: Array<Option>) => {
    const values = newValues.map((item) => {
      const pair = item.value.split(".");
      return { runtimeId: pair[0], serviceUuid: pair[1] };
    });
    onChange(values);
  };

  return (
    <div className="pr-2 pt-2 flex flex-col">
      <MultipleSelector
        options={options}
        placeholder="Add Targets ..."
        value={mappedValues}
        onChange={onChangeSelector}
        emptyIndicator={
          <p className="text-center text-lg leading-10 text-gray-600 dark:text-gray-400">
            No results found.
          </p>
        }
        hidePlaceholderWhenSelected
        badgeClassName="bg-sky-600 hover:bg-sky-400"
      />
    </div>
  );
}
