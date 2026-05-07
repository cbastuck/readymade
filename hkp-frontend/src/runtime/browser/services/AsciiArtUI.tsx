import { useState } from "react";
import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import Slider from "hkp-frontend/src/ui-components/Slider";

const CHARSET_OPTIONS: { [key: string]: string } = {
  " .:-=+*#%@":  "Classic",
  " .,;+=x#&@$": "Dense",
  " ░▒▓█":       "Blocks",
  " .+|#":       "Sharp",
  " @":          "Binary",
};

const DEFAULT_CHARSET = " .:-=+*#%@";

export default function AsciiArtUI(props: ServiceUIProps) {
  const [cols, setCols] = useState(100);
  const [rows, setRows] = useState(60);
  const [invert, setInvert] = useState(false);
  const [charset, setCharset] = useState(DEFAULT_CHARSET);

  const onInit = (state: any) => {
    if (needsUpdate(state.cols, cols)) setCols(state.cols);
    if (needsUpdate(state.rows, rows)) setRows(state.rows);
    if (needsUpdate(state.invert, invert)) setInvert(state.invert);
    if (needsUpdate(state.charset, charset)) setCharset(state.charset);
  };

  const onNotification = (params: any) => {
    if (params?.cols !== undefined) setCols(params.cols);
    if (params?.rows !== undefined) setRows(params.rows);
    if (params?.invert !== undefined) setInvert(params.invert);
    if (params?.charset !== undefined) setCharset(params.charset);
  };

  const updateCols = (val: number) => {
    setCols(val);
    (props.service as any).configure({ cols: val });
  };

  const updateRows = (val: number) => {
    setRows(val);
    (props.service as any).configure({ rows: val });
  };

  const toggleInvert = () => {
    const next = !invert;
    setInvert(next);
    (props.service as any).configure({ invert: next });
  };

  const updateCharset = (val: string) => {
    setCharset(val);
    (props.service as any).configure({ charset: val });
  };

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 220, height: undefined }}
    >
      <div
        style={{
          padding: "10px 0 6px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <Slider
          title="Columns"
          value={cols}
          min={20}
          max={120}
          onChange={updateCols}
        />

        <Slider
          title="Rows"
          value={rows}
          min={10}
          max={120}
          onChange={updateRows}
        />

        <SelectorField
          label="Charset"
          value={charset}
          options={CHARSET_OPTIONS}
          onChange={({ value }) => updateCharset(value)}
        />

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--text-mid, #666)",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input type="checkbox" checked={invert} onChange={toggleInvert} />
          Invert brightness
        </label>
      </div>
    </ServiceUI>
  );
}
