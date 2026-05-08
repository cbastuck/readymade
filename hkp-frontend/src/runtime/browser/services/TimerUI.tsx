import { useState } from "react";
import { RotateCcw } from "lucide-react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import PillRadioGroup from "hkp-frontend/src/ui-components/PillRadioGroup";
import Slider from "hkp-frontend/src/ui-components/Slider";
import OneOfVisible from "hkp-frontend/src/ui-components/OneOfVisible";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";

export default function TimerUI(props: ServiceUIProps) {
  const { service } = props;

  const modes = ["oneshot", "periodic"];
  const units = ["ms", "s", "m", "h", "d", "bpm", "hz"];

  const [periodic, setPeriodic] = useState(false);
  const mode = periodic ? "periodic" : "oneshot";
  const modeIdx = periodic ? 1 : 0;

  const [interval, setInterval] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState(units[1]);
  const [isIntervalRunning, setIsIntervalRunning] = useState(false);
  const [isBypassed, setIsBypassed] = useState(false);

  const [delay, setDelay] = useState(0);
  const [delayUnit, setDelayUnit] = useState(units[0]);

  const onTriggerOneshot = () => {
    service.configure({
      periodic: false,
      start: true,
      oneShotDelay: delay,
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
    const {
      periodic,
      periodicValue,
      periodicUnit,
      oneShotDelay,
      oneShotDelayUnit,
      running,
      bypass,
    } = state || {};
    if (periodic !== undefined) {
      setPeriodic(!!periodic);
    }
    if (needsUpdate(periodicValue, interval)) {
      setInterval(periodicValue);
    }
    if (needsUpdate(periodicUnit, intervalUnit)) {
      setIntervalUnit(periodicUnit);
    }
    if (needsUpdate(oneShotDelay, delay)) {
      setDelay(oneShotDelay);
    }
    if (needsUpdate(oneShotDelayUnit, delayUnit)) {
      setDelayUnit(oneShotDelayUnit);
    }
    if (needsUpdate(running, isIntervalRunning)) {
      setIsIntervalRunning(running);
    }
    if (needsUpdate(bypass, isBypassed)) {
      setIsBypassed(!!bypass);
    }
  };

  const onNotification = (notification: any) => update(notification);

  const onInit = (initialState: any) => update(initialState);

  const onIntervalSlider = (newValue: number) => {
    setInterval(newValue);
    if (isIntervalRunning) {
      service.configure({
        periodicValue: newValue,
      });
    }
  };

  const onIntervalUnit = (newUnit: string) => {
    setIntervalUnit(newUnit);
    if (isIntervalRunning) {
      service.configure({
        periodicUnit: newUnit,
      });
    }
  };

  const onDelayUnit = (newUnit: string) => {
    setDelayUnit(newUnit);
    service.configure({
      oneShotDelayUnit: newUnit,
    });
  };

  const customMenuEntries = [
    {
      name: "Reset Timer",
      icon: <MenuIcon icon={RotateCcw} />,
      config: { counter: 0 },
    },
  ];

  const onDelayChanged = (newDelay: number) => {
    service.configure({ oneShotDelay: newDelay });
    setDelay(newDelay);
  };

  const onChangeMode = (newMode: string) => {
    setPeriodic(newMode === "periodic");
    service.configure({ periodic: newMode === "periodic" });
  };
  return (
    <ServiceUI
      {...props}
      initialSize={{ width: 210, height: 180 }}
      service={service}
      onInit={onInit}
      onNotification={onNotification}
      customMenuEntries={customMenuEntries}
    >
      <div className="flex flex-col gap-3 h-full">
        <PillRadioGroup
          title="Mode"
          options={modes}
          value={mode}
          onChange={onChangeMode}
        />
        <OneOfVisible current={modeIdx}>
          <div className="flex flex-col gap-4">
            <Slider
              title="Delay"
              value={delay}
              unit={delayUnit}
              units={units}
              onChange={onDelayChanged}
              onUnit={onDelayUnit}
              min={0}
              max={1000}
            />
            <Button
              className="hkp-svc-btn"
              variant="outline"
              onClick={onTriggerOneshot}
            >
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
              onUnit={onIntervalUnit}
              min={1}
              max={
                intervalUnit === "ms"
                  ? 1000
                  : intervalUnit === "bpm"
                    ? 300
                    : intervalUnit === "hz"
                      ? 30
                      : 100
              }
            />
            <div className="flex gap-[5px]">
              <Button
                className="hkp-svc-btn w-full"
                variant="outline"
                onClick={onStop}
                disabled={!isIntervalRunning}
              >
                Stop
              </Button>
              <Button
                className="hkp-svc-btn w-full hkp-btn-primary"
                variant="default"
                onClick={onStart}
                disabled={isIntervalRunning || isBypassed}
              >
                Start
              </Button>
            </div>
          </div>
        </OneOfVisible>
      </div>
    </ServiceUI>
  );
}
