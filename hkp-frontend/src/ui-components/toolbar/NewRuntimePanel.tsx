import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RuntimeClass } from "@/types";
import { useState } from "react";

type Props = {
  onAddRuntime: (rtClass: RuntimeClass) => void;
};

export default ({ onAddRuntime }: Props) => {
  const [host, setHost] = useState("");
  const [name, setName] = useState("");
  return (
    <div>
      <Label htmlFor="name" className="text-right font-sans">
        Runtime Name
      </Label>
      <Input
        id="name"
        value={name}
        onChange={(ev) => setName(ev.target.value)}
      />

      <Label htmlFor="host" className="text-right font-sans">
        Runtime Host URL
      </Label>
      <Input
        id="host"
        value={host}
        onChange={(ev) => setHost(ev.target.value)}
      />

      <div className="mt-2 w-full text-right">
        <Button
          onClick={() => onAddRuntime({ type: "remote", name, url: host })}
          disabled={!name || !host}
        >
          Add
        </Button>
      </div>
    </div>
  );
};
