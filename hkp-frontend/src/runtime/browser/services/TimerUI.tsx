import { useState } from "react";

import { AppImpl, ServiceDescriptor } from "@/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { Button } from "hkp-frontend/src/components/ui/button";
import RadioGroup from "@/ui-components/RadioGroup";
import Slider from "@/ui-components/Slider";
import OneOfVisible from "@/ui-components/OneOfVisible";

type Props = {
  service: ServiceDescriptor;
  app: AppImpl;
};

export default function TimerUI(props: Props) {
  const { service, app } = props;

  const modes = ["oneshot", "periodic"];
  const units = ["ms", "s", "m", "h", "d"];

  const [mode, setMode] = useState(modes[0]);
  const modeIdx = modes.indexOf(mode);

  const [interval, setInterval] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState(units[1]);
  const [isIntervalRunning, setIsIntervalRunning] = useState(false);

  const [delay, setDelay] = useState(0);
  const [delayUnit, setDelayUnit] = useState(units[0]);

  const onTrigger = () => {
    service.configure({
      periodic: false,
      start: true,
      command: {
        action: "start",
      },
    });
  };
  const onStart = () => {
    service.configure({
      periodic: true,
      periodicValue: interval,
      periodicUnit: intervalUnit,
      start: true,
    });
  };
  const onStop = () => {
    service.configure({ stop: true });
  };

  const update = (state: any) => {
    const { periodicValue, periodicUnit, oneShotDelay, running } = state || {};
    if (needsUpdate(periodicValue, interval)) {
      setInterval(periodicValue);
    }
    if (needsUpdate(periodicUnit, intervalUnit)) {
      setIntervalUnit(periodicUnit);
    }
    if (needsUpdate(oneShotDelay, delay)) {
      setDelay(delay);
    }
    if (needsUpdate(running, isIntervalRunning)) {
      setIsIntervalRunning(running);
    }
  };

  const onNotification = (_: ServiceDescriptor, notification: any) =>
    update(notification);

  const onInit = (initialState: any) => update(initialState);

  const onIntervalSlider = (newValue: number) => {
    setInterval(newValue);
    if (isIntervalRunning) {
      service.configure({
        periodicValue: newValue,
      });
    }
  };

  return (
    <ServiceUI
      {...props}
      app={app}
      initialSize={{ width: 400, height: 150 }}
      service={service}
      onInit={onInit}
      onNotification={onNotification}
    >
      <div className="flex flex-col gap-2 h-full">
        <RadioGroup title="Mode" items={modes} initial={0} onChange={setMode} />
        <OneOfVisible current={modeIdx}>
          <div className="flex flex-col gap-4">
            <Slider
              title="Delay"
              value={delay}
              unit={delayUnit}
              units={units}
              onChange={setDelay}
              onUnit={setDelayUnit}
              min={1}
              max={100}
            />
            <Button variant="outline" onClick={onTrigger}>
              Trigger Oneshot
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            <Slider
              title="Interval"
              value={interval}
              units={units}
              onChange={onIntervalSlider}
              unit={intervalUnit}
              onUnit={setIntervalUnit}
              min={1}
              max={100}
            />
            <div className="flex gap-2">
              <Button
                className="w-full"
                variant="outline"
                onClick={onStart}
                disabled={isIntervalRunning}
              >
                Start Interval
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={onStop}
                disabled={!isIntervalRunning}
              >
                Stop Interval
              </Button>
            </div>
          </div>
        </OneOfVisible>
      </div>
    </ServiceUI>
  );
}

function needsUpdate<T>(newValue: T, oldValue: T) {
  return newValue !== undefined && newValue !== oldValue;
}
