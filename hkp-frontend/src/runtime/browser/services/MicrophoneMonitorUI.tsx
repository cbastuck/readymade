import { useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import Slider from "hkp-frontend/src/ui-components/Slider";

export default function MicrophoneMonitorUI(props: ServiceUIProps) {
  const { service } = props;

  const [running, setRunning] = useState(false);
  const [interval, setIntervalMs] = useState(500);
  const [status, setStatus] = useState<string | null>(null);
  const [levelDb, setLevelDb] = useState<number | null>(null);
  const [_level, setLevel] = useState<number | null>(null);

  const update = (state: any) => {
    if (needsUpdate(state.running, running)) setRunning(!!state.running);
    if (needsUpdate(state.interval, interval)) setIntervalMs(state.interval);
    if (state.status !== undefined) setStatus(state.status);
    if (state.levelDb !== undefined) setLevelDb(state.levelDb);
    if (state.level !== undefined) setLevel(state.level);
  };

  // Map dB range [-60, 0] to [0, 100]%
  const levelPercent =
    levelDb !== null ? Math.min(Math.max((levelDb + 60) / 60, 0), 1) * 100 : 0;
  const dbDisplay = levelDb !== null ? `${levelDb.toFixed(1)} dB` : "--";

  return (
    <ServiceUI
      {...props}
      initialSize={{ width: 278, height: 185 }}
      service={service}
      onInit={update}
      onNotification={update}
    >
      <div className="flex flex-col gap-3 h-full">
        <Slider
          title="Interval (ms)"
          value={interval}
          min={100}
          max={2000}
          onChange={(v: number) => {
            setIntervalMs(v);
            service.configure({ interval: v });
          }}
        />
        <div className="flex gap-2">
          <Button
            className="w-full"
            variant="outline"
            onClick={() => service.configure({ start: true, interval })}
            disabled={running}
          >
            Start
          </Button>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => service.configure({ stop: true })}
            disabled={!running}
          >
            Stop
          </Button>
        </div>
        <div className="flex flex-col gap-1">
          <div className="h-3 bg-muted rounded overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-100"
              style={{ width: `${levelPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{dbDisplay}</span>
            <span>{status ?? (running ? "monitoring" : "stopped")}</span>
          </div>
        </div>
      </div>
    </ServiceUI>
  );
}
