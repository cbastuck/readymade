import { useState } from "react";

import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import { Input } from "hkp-frontend/src/ui-components/primitives/input";
import { Label } from "hkp-frontend/src/ui-components/primitives/label";
import { RuntimeClass } from "hkp-frontend/src/types";

type Props = {
  onAddRuntime: (rtClass: RuntimeClass) => void;
};

// Remote runtimes are registered as REST; GraphQL is legacy and not offered.
export default function NewRuntimePanel({ onAddRuntime }: Props) {
  const [host, setHost] = useState("");
  const [name, setName] = useState("");
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="name"
          className="text-xs font-semibold uppercase tracking-wider text-slate-500"
        >
          Name
        </Label>
        <Input
          id="name"
          style={{ fontSize: 16 }}
          value={name}
          onChange={(ev) => setName(ev.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="host"
          className="text-xs font-semibold uppercase tracking-wider text-slate-500"
        >
          Host URL
        </Label>
        <Input
          id="host"
          style={{ fontSize: 16 }}
          value={host}
          onChange={(ev) => setHost(ev.target.value)}
        />
      </div>

      <div className="w-full text-right">
        <Button
          size="sm"
          onClick={() => onAddRuntime({ type: "rest", name, url: host })}
          disabled={!name || !host}
        >
          Register Runtime
        </Button>
      </div>
    </div>
  );
}
