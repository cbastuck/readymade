import { useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import InputField from "hkp-frontend/src/components/shared/InputField";
import Button from "hkp-frontend/src/ui-components/Button";
import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";
import PillRadioGroup from "hkp-frontend/src/ui-components/PillRadioGroup";
import Editor from "hkp-frontend/src/components/shared/Editor";
import { EMITS, MODES } from "./sql-modes";

/**
 * The browser SQL service's panel.
 *
 * The statement first, because it is what the service is; the schema below it,
 * because most services on a board leave it to one other. Run tries the
 * statement with no parameters and shows what it did — the rest of the
 * pipeline is not called, so trying a DELETE here changes the tables but
 * nothing downstream.
 */

const MODE_LABELS: Record<string, string> = {
  query: "Query",
  run: "Run",
  exec: "Exec",
  databases: "Databases",
  export: "Export",
  import: "Import",
};

/** Modes that run what the panel's statement field holds. */
const USES_STATEMENT = new Set(["query", "run", "exec"]);

const EMIT_LABELS: Record<string, string> = {
  result: "Result",
  input: "Input",
};

/** One line saying what the last statement did. */
function describe(result: any): string | null {
  if (typeof result?.exported === "string") {
    return `exported ${result.exported} (${result.bytes} characters)`;
  }
  if (typeof result?.count === "number") {
    return `${result.count} row${result.count === 1 ? "" : "s"}`;
  }
  if (typeof result?.changes === "number") {
    return `${result.changes} change${result.changes === 1 ? "" : "s"}`;
  }
  if (result?.executed === true) {
    return "executed";
  }
  return null;
}

export default function SqlUI(props: ServiceUIProps) {
  const [mode, setMode] = useState<string>("query");
  const [emit, setEmit] = useState<string>("result");
  const [database, setDatabase] = useState("");
  const [statement, setStatement] = useState("");
  const [schema, setSchema] = useState("");
  const [outcome, setOutcome] = useState("");
  const [error, setError] = useState("");

  const update = (config: any) => {
    if (
      typeof config?.mode === "string" &&
      (MODES as readonly string[]).includes(config.mode)
    ) {
      setMode(config.mode);
    }
    if (
      typeof config?.emit === "string" &&
      (EMITS as readonly string[]).includes(config.emit)
    ) {
      setEmit(config.emit);
    }
    if (
      config?.database !== undefined &&
      needsUpdate(config.database, database)
    ) {
      setDatabase(config.database);
    }
    if (
      config?.statement !== undefined &&
      needsUpdate(config.statement, statement)
    ) {
      setStatement(config.statement);
    }
    if (config?.schema !== undefined && needsUpdate(config.schema, schema)) {
      setSchema(config.schema);
    }
    // A result replaces whatever the last pass said, failure included.
    const done = describe(config);
    if (done !== null) {
      setOutcome(done);
      setError("");
    }
    if (typeof config?.error === "string") {
      setOutcome("");
      setError(config.error);
    }
  };

  const configure = (config: any) => props.service.configure(config);

  return (
    <ServiceUI
      {...props}
      onInit={update}
      onNotification={update}
      initialSize={{ width: 420, height: undefined }}
    >
      <div
        className="h-full flex flex-col my-2 gap-2"
        style={{ width: "100%", textAlign: "left" }}
      >
        <PillRadioGroup
          title="Mode"
          options={MODE_LABELS}
          value={mode}
          onChange={(value) => configure({ mode: value })}
        />

        <PillRadioGroup
          title="Passes on"
          options={EMIT_LABELS}
          value={emit}
          onChange={(value) => configure({ emit: value })}
        />

        <InputField
          value={database}
          label="Database"
          onChange={(value) => configure({ database: value })}
        />

        {USES_STATEMENT.has(mode) ? (
          <div className="flex flex-col gap-1">
            <GroupLabel className="hkp-svc-field-label" size={4}>
              Statement
            </GroupLabel>
            <div className="h-[140px] w-full">
              <Editor
                value={statement}
                onChange={(value) => configure({ statement: value || "" })}
                language="sql"
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <GroupLabel className="hkp-svc-field-label" size={4}>
            Schema
          </GroupLabel>
          <div className="h-[100px] w-full">
            <Editor
              value={schema}
              onChange={(value) => configure({ schema: value || "" })}
              language="sql"
            />
          </div>
        </div>

        <Button
          className="hkp-svc-btn w-full"
          onClick={() => props.service.process({})}
        >
          Run
        </Button>

        {outcome || error ? (
          <div className="text-xs">
            <span className="opacity-60">{outcome}</span>
            {error ? <span style={{ color: "#ef4444" }}>{error}</span> : null}
          </div>
        ) : null}
      </div>
    </ServiceUI>
  );
}
