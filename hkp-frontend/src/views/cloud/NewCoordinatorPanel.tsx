import { useState } from "react";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import { Input } from "hkp-frontend/src/ui-components/primitives/input";
import { Label } from "hkp-frontend/src/ui-components/primitives/label";
import { CoordinatorDescriptor } from "../../common";

type Props = {
  onAdd: (coordinator: CoordinatorDescriptor) => void;
};

export default function NewCoordinatorPanel({ onAdd }: Props) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("http://127.0.0.1:8080/coordinator");

  const onSubmit = () => {
    if (!name || !url) {
      return;
    }
    const base = url.replace(/\/$/, "");
    const normalized = base.endsWith("/coordinator")
      ? base
      : `${base}/coordinator`;
    onAdd({ name, url: normalized });
    setName("");
    setUrl("");
  };

  return (
    <div className="flex flex-col gap-2">
      <Label
        htmlFor="coord-name"
        className="text-left font-sans text-md tracking-widest"
      >
        Name
      </Label>
      <Input
        id="coord-name"
        // text-base (16px) avoids iOS auto-zoom on focus (anything < 16px zooms).
        className="font-menu text-base"
        placeholder="My Coordinator"
        value={name}
        onChange={(ev) => setName(ev.target.value)}
      />

      <Label
        htmlFor="coord-url"
        className="text-left font-sans text-md tracking-widest"
      >
        Base URL
      </Label>
      <Input
        id="coord-url"
        className="font-menu text-base"
        placeholder="http://127.0.0.1:8080/coordinator"
        value={url}
        onChange={(ev) => setUrl(ev.target.value)}
      />

      <div className="mt-2 w-full text-right">
        <Button className="text-md" onClick={onSubmit} disabled={!name || !url}>
          Add Coordinator
        </Button>
      </div>
    </div>
  );
}
