import { useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import Slider from "hkp-frontend/src/ui-components/Slider";

export default function DebounceUI(props: ServiceUIProps) {
  const { service } = props;

  const [cooldown, setCooldown] = useState(60);
  const [lastFired, setLastFired] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const update = (state: any) => {
    if (needsUpdate(state.cooldown, cooldown)) setCooldown(state.cooldown);
    if (state.lastFired !== undefined) {
      setLastFired(state.lastFired);
      if (state.remaining === null) setRemaining(null);
    }
    if (state.remaining !== undefined) setRemaining(state.remaining);
  };

  const lastFiredDisplay = lastFired
    ? new Date(lastFired).toLocaleTimeString()
    : "never";

  return (
    <ServiceUI
      {...props}
      className="py-2"
      initialSize={{ width: 278, height: 155 }}
      service={service}
      onInit={update}
      onNotification={update}
    >
      <div className="flex flex-col gap-3 h-full">
        <Slider
          title="Cooldown (s)"
          value={cooldown}
          min={1}
          max={3600}
          onChange={(v: number) => {
            setCooldown(v);
            service.configure({ cooldown: v });
          }}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Last fired: {lastFiredDisplay}</span>
          {remaining !== null && <span>Ready in: {remaining}s</span>}
        </div>
        <Button
          variant="outline"
          onClick={() => service.configure({ reset: true })}
        >
          Reset Cooldown
        </Button>
      </div>
    </ServiceUI>
  );
}
