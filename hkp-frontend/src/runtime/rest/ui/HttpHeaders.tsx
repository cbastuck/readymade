import InputField from "hkp-frontend/src/components/shared/InputField";
import AutocompleteInputField from "hkp-frontend/src/components/shared/AutocompleteInputField";
import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";
import { useMemo } from "react";
import DeleteButton from "../../../ui-components/DeleteButton";

type Props = {
  headers: { id: string; key: string; value: string }[];
  onAddHeader: () => void;
  onRemoveHeader: (id: string) => void;
  onUpdateHeaderKey: (id: string, key: string) => void;
  onUpdateHeaderValue: (id: string, value: string) => void;
};
export default function HttpHeaders({
  headers,
  onAddHeader,
  onRemoveHeader,
  onUpdateHeaderKey,
  onUpdateHeaderValue,
}: Props) {
  /**
   * Names worth offering, not the names allowed.
   *
   * A header name is open-ended — `xi-api-key`, `anthropic-version`, whatever
   * an API asks for — so the field is one to type in, with these as
   * suggestions. It was a fixed list once, and a name outside it could neither
   * be typed nor displayed: a header a board really held showed as an empty
   * box with a value beside it.
   */
  const suggestions = useMemo(
    () => ({
      "content-type": 1,
      authorization: 1,
      accept: 1,
      "accept-language": 1,
      "cache-control": 1,
      cookie: 1,
      origin: 1,
      referer: 1,
      "x-api-key": 1,
      "x-requested-with": 1,
    }),
    [],
  );

  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-center justify-between">
        <GroupLabel className="hkp-svc-field-label" size={4}>
          Headers
        </GroupLabel>
        <button
          onClick={onAddHeader}
          className="hkp-svc-btn px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1"
        >
          <span>+</span>
          <span>Add Header</span>
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {headers.map((header) => (
          <div key={header.id} className="flex gap-2 items-center">
            <div className="w-40">
              <AutocompleteInputField
                value={header.key}
                autoCompleteValueSuggestions={suggestions as any}
                selectAllOnFocus={false}
                onSubmit={(key) => onUpdateHeaderKey(header.id, key)}
                onTab={(key) => onUpdateHeaderKey(header.id, key)}
                onChangePending={() => {}}
              />
            </div>
            <div className="flex-1">
              <InputField
                label=""
                value={header.value}
                onChange={(value) => onUpdateHeaderValue(header.id, value)}
              />
            </div>
            <DeleteButton
              title={`Delete header "${header.key}"`}
              onClick={() => onRemoveHeader(header.id)}
            />
          </div>
        ))}
        {headers.length === 0 && (
          <div className="text-xs text-gray-400 italic py-2">
            No headers added. Click "Add Header" to add one.
          </div>
        )}
      </div>
    </div>
  );
}
