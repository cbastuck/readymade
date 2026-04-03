import { Button } from "hkp-frontend/src/ui-components/primitives/button";

import { Input } from "hkp-frontend/src/ui-components/primitives/input";
import { Label } from "hkp-frontend/src/ui-components/primitives/label";
import { RuntimeClass } from "hkp-frontend/src/types";
import { useState } from "react";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";

type Props = {
  onAddRuntime: (rtClass: RuntimeClass) => void;
};

export default function NewRuntimePanel({ onAddRuntime }: Props) {
  const [host, setHost] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"remote" | "realtime">("remote");
  return (
    <div>
      <Label
        htmlFor="name"
        className="text-left font-sans text-md tracking-widest"
      >
        Runtime Name
      </Label>
      <Input
        id="name"
        className="font-menu text-md"
        value={name}
        onChange={(ev) => setName(ev.target.value)}
      />

      <Label
        htmlFor="host"
        className="text-left font-sans text-md tracking-widest"
      >
        Runtime Host URL
      </Label>
      <Input
        id="host"
        className="font-menu text-md "
        value={host}
        onChange={(ev) => setHost(ev.target.value)}
      />
      <Label className="mt-2 text-left font-sans text-md tracking-widest">
        Runtime Type
      </Label>
      <SelectorField
        className="mb-2"
        options={{ remote: "graphql", realtime: "rest" }}
        value={type}
        onChange={({ value }) => setType(value as any)}
      />

      <div className="mt-2 w-full text-right">
        <Button
          className="text-md"
          onClick={() => onAddRuntime({ type, name, url: host })}
          disabled={!name || !host}
        >
          Register Runtime
        </Button>
      </div>
    </div>
  );
}
