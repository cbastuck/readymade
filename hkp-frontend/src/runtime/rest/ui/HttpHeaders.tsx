import InputField from "hkp-frontend/src/components/shared/InputField";
import SelectorField, {
  OnChangeValue,
} from "hkp-frontend/src/components/shared/SelectorField";
import { useMemo } from "react";
import DeleteButton from "../../../ui-components/DeleteButton";

type Props = {
  headers: { id: string; key: string; value: string }[];
  onAddHeader: () => void;
  onRemoveHeader: (id: string) => void;
  onUpdateHeaderKey: (id: string, value: OnChangeValue) => void;
  onUpdateHeaderValue: (id: string, value: string) => void;
};
export default function HttpHeaders({
  headers,
  onAddHeader,
  onRemoveHeader,
  onUpdateHeaderKey,
  onUpdateHeaderValue,
}: Props) {
  const headerKeyOptions = useMemo(
    () => ({
      "content-type": "Content-Type",
      authorization: "Authorization",
      accept: "Accept",
      "accept-language": "Accept-Language",
      "cache-control": "Cache-Control",
      cookie: "Cookie",
      origin: "Origin",
      referer: "Referer",
      "x-api-key": "X-API-Key",
      "x-requested-with": "X-Requested-With",
      custom: "Custom",
    }),
    []
  );

  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-left tracking-[4px]">Headers</h3>
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
              <SelectorField
                value={header.key}
                label=""
                options={headerKeyOptions}
                onChange={(value) => onUpdateHeaderKey(header.id, value)}
                labelStyle={{
                  textTransform: "none",
                  textAlign: "left",
                }}
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
