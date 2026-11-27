import { useEffect, useState } from "react";

import {
  ResourceAnswer,
  UnboundResource,
  registerResourcePrompt,
} from "hkp-frontend/src/core/resourcePrompt";
import {
  ResourceBinding,
  ResourceDescriptor,
} from "hkp-frontend/src/runtime/board/resources";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import { Input } from "hkp-frontend/src/ui-components/primitives/input";

import { toServerBaseUrl } from "./connections/serverUrl";

type Pending = {
  wanted: UnboundResource;
  answer: (binding: ResourceAnswer) => void;
};

function describeResource(resource: ResourceDescriptor): string {
  switch (resource.kind) {
    case "ollama":
      return resource.models?.length
        ? `Ollama (${resource.models.join(", ")})`
        : "Ollama";
    case "postgres":
      return resource.version ? `Postgres ${resource.version}` : "Postgres";
    case "s3":
      return "S3 storage";
  }
}

function defaultPlaceholder(resource: ResourceDescriptor): string {
  switch (resource.kind) {
    case "ollama":
      return "http://127.0.0.1:11434";
    case "postgres":
      return "postgres://127.0.0.1:5432/app";
    case "s3":
      return "http://127.0.0.1:9000";
  }
}

/**
 * Asks how to bind a resource a board needs when none is bound yet, and keeps
 * the answer.
 *
 * Choosing "Not now" (or dismissing) answers with `null`, which leaves the
 * board loading and lets the services naming the resource report that it is
 * not bound when they resolve it (`core/resourcePrompt.ts`).
 */
export default function UnboundResourceDialog() {
  const [queue, setQueue] = useState<Pending[]>([]);
  const [address, setAddress] = useState("");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState("");
  const [bucket, setBucket] = useState("");

  useEffect(
    () =>
      registerResourcePrompt(
        (wanted) =>
          new Promise<ResourceAnswer>((resolve) => {
            setQueue((pending) => [...pending, { wanted, answer: resolve }]);
          }),
      ),
    [],
  );

  const current = queue[0];
  if (!current) {
    return null;
  }

  const settle = (binding: ResourceAnswer) => {
    current.answer(binding);
    setQueue((pending) => pending.slice(1));
    setAddress("");
    setUser("");
    setPassword("");
    setDatabase("");
    setBucket("");
  };

  const { resource } = current.wanted;
  const label = describeResource(resource);

  const buildBinding = (): ResourceBinding | null => {
    const trimmed = address.trim();
    if (!trimmed) {
      return null;
    }
    switch (resource.kind) {
      case "ollama": {
        const url = toServerBaseUrl(trimmed);
        return url ? { id: resource.id, kind: "ollama", url } : null;
      }
      case "postgres": {
        return {
          id: resource.id,
          kind: "postgres",
          url: trimmed,
          ...(user.trim() ? { user: user.trim() } : {}),
          ...(password ? { password } : {}),
          ...(database.trim() ? { database: database.trim() } : {}),
        };
      }
      case "s3": {
        const endpoint = toServerBaseUrl(trimmed) ?? trimmed;
        return {
          id: resource.id,
          kind: "s3",
          endpoint,
          ...(bucket.trim() ? { bucket: bucket.trim() } : {}),
          ...(user.trim() ? { accessKey: user.trim() } : {}),
          ...(password ? { secretKey: password } : {}),
        };
      }
    }
  };

  const candidate = buildBinding();
  const bindAddress = () => {
    if (!candidate) {
      return;
    }
    settle(candidate);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          settle(null);
        }
      }}
    >
      <DialogContent className="max-w-lg w-[92vw]">
        <DialogHeader>
          <DialogTitle>
            Bind resource “{resource.name || resource.id}”
          </DialogTitle>
          <DialogDescription>
            This board needs a <span className="font-medium">{label}</span>{" "}
            resource (<span className="font-mono">{resource.id}</span>). A board
            says what kind of resource it needs, never where it runs, and this
            one is not bound yet.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1 text-sm text-slate-700 leading-snug">
          <div className="flex flex-col gap-1.5">
            <div className="font-medium text-slate-900">Use one I have</div>
            <span>
              The address your {label} runs at. It is kept for{" "}
              <span className="font-mono">{resource.id}</span> on this board.
            </span>
            <div className="flex gap-2">
              <Input
                aria-label={`Address of ${resource.id}`}
                style={{ fontSize: 16 }}
                placeholder={defaultPlaceholder(resource)}
                value={address}
                onChange={(ev) => setAddress(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    bindAddress();
                  }
                }}
              />
              <Button
                size="sm"
                className="h-10"
                disabled={!candidate}
                onClick={bindAddress}
              >
                Bind
              </Button>
            </div>
            {resource.kind === "postgres" && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <Input
                  aria-label="Database"
                  placeholder="Database"
                  value={database}
                  onChange={(ev) => setDatabase(ev.target.value)}
                />
                <Input
                  aria-label="User"
                  placeholder="User"
                  value={user}
                  onChange={(ev) => setUser(ev.target.value)}
                />
                <Input
                  aria-label="Password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                />
              </div>
            )}
            {resource.kind === "s3" && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <Input
                  aria-label="Bucket"
                  placeholder="Bucket"
                  value={bucket}
                  onChange={(ev) => setBucket(ev.target.value)}
                />
                <Input
                  aria-label="Access key"
                  placeholder="Access key"
                  value={user}
                  onChange={(ev) => setUser(ev.target.value)}
                />
                <Input
                  aria-label="Secret key"
                  type="password"
                  placeholder="Secret key"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={() => settle(null)}>
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
