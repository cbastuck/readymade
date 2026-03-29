import { useState } from "react";
import { RotateCcw } from "lucide-react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";
import Slider from "hkp-frontend/src/ui-components/Slider";
import OneOfVisible from "hkp-frontend/src/ui-components/OneOfVisible";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";

export default function TimerUI(props: ServiceUIProps) {
  const { service } = props;

  const modes = ["oneshot", "periodic"];
  const units = ["ms", "s", "m", "h", "d"];

  const [mode, setMode] = useState(modes[0]);
  const modeIdx = modes.indexOf(mode);

  const [interval, setInterval] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState(units[1]);
  const [isIntervalRunning, setIsIntervalRunning] = useState(false);

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
      periodicValue,
      periodicUnit,
      oneShotDelay,
      oneShotDelayUnit,
      running,
    } = state || {};
    if (state.periodic === true && mode !== "periodic") {
      setMode("periodic");
    }
    if (state.periodic === false && mode !== "oneshot") {
      setMode("oneshot");
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
    setMode(newMode);
    service.configure({ periodic: newMode === "periodic" });
  };
  return (
    <ServiceUI
      {...props}
      initialSize={{ width: 278, height: 155 }}
      service={service}
      onInit={onInit}
      onNotification={onNotification}
      customMenuEntries={customMenuEntries}
    >
      <div className="flex flex-col gap-2 h-full">
        <RadioGroup
          id="TimerMode"
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
            <Button variant="outline" onClick={onTriggerOneshot}>
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
