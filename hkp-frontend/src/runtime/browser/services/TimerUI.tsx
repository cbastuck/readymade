import { useState } from "react";

import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import InputField from "hkp-frontend/src/components/shared/InputField";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import { Button } from "hkp-frontend/src/components/ui/button";
import { s, t } from "hkp-frontend/src/styles";
import { ServiceDescriptor } from "@/types";
import RadioGroup from "@/ui-components/RadioGroup";
import Slider from "@/ui-components/Slider";
import OneOfVisible from "@/ui-components/OneOfVisible";

type Props = {
  service: ServiceDescriptor;
};

export default function TimerUI(props: Props) {
  const [state, setState] = useState({
    timerIsRunning: false,
    periodic: false,
    periodicValue: 1,
    periodicUnit: "s",
    oneShotDelay: 0,
    counter: 0,
  });

  const onInit = (initialState: any) => {
    if (initialState) {
      setState({
        periodic: initialState.periodic,
        periodicValue: initialState.periodicValue,
        periodicUnit: initialState.periodicUnit,
        oneShotDelay: initialState.oneShotDelay,
        timerIsRunning: initialState.running,
        counter: initialState.counter,
      });
    }
  };

  const onNotification = (_: ServiceDescriptor, notification: any) => {
    const { running, counter } = notification;
    const updatedState = {};
    if (running !== undefined) {
      updatedState.timerIsRunning = running;
    }
    if (counter !== undefined) {
      updatedState.counter = counter;
    }
    setState(updatedState);
  };

  const renderPeriodic = (service) => {
    const buttonStyle = s(t.m1, t.fs12, t.ls1, t.w100);
    return (
      <div>
        <InputField
          type="number"
          label="interval"
          value={state.periodicValue}
          onChange={async (_, { value }) => {
            await service.configure({ periodicValue: Number(value) });
            setState({ periodicValue: Number(value) });
          }}
        />
        <SelectorField
          style={t.mt3}
          label="unit"
          options={{
            ms: "milliseconds",
            s: "seconds",
            m: "minutes",
            h: "hours",
            d: "days",
          }}
          value={state.periodicUnit}
          onChange={async (_ev, { value }) => {
            await service.configure({ periodicUnit: value });
            setState({ periodicUnit: value });
          }}
        />
        <div
          style={{ display: "flex", flexDirection: "row", marginTop: "5px" }}
        >
          <Button
            style={buttonStyle}
            onClick={() =>
              service.configure({
                periodic: true,
                periodicValue: state.periodicValue,
                periodicUnit: state.periodicUnit,
                start: true,
              })
            }
            disabled={!!state.timerIsRunning}
          >
            Start
          </Button>
          <Button
            style={buttonStyle}
            onClick={() => service.configure({ stop: true })}
            disabled={!state.timerIsRunning}
          >
            Stop
          </Button>
        </div>
      </div>
    );
  };

  const renderOneShot = (service) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        paddingBottom: 3,
      }}
    >
      <InputField
        type="number"
        label="delay"
        unit="msec"
        value={state.oneShotDelay || "0"}
        onChange={async (_, { value: oneShotDelay }) => {
          await service.configure({ oneShotDelay });
          setState({ oneShotDelay });
        }}
      />
      <Button
        style={{ marginTop: "3px", width: "100%" }}
        onClick={() =>
          service.configure({
            periodic: false,
            start: true,
            command: {
              action: "start",
            },
          })
        }
      >
        Trigger
      </Button>
    </div>
  );

  const renderCounter = (service) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        paddingBottom: 3,
      }}
    >
      <InputField
        type="number"
        label="Counter"
        value={state.counter}
        onChange={(_, { value: counter }) => {
          service.configure({
            counter,
            periodic: false,
            start: true,
          });
        }}
      />
      <Button
        style={{ marginTop: "3px", width: "100%" }}
        onClick={() =>
          service.configure({
            periodic: false,
            start: true,
          })
        }
      >
        Trigger
      </Button>
    </div>
  );

  const modes = ["oneshot", "periodic"];
  const units = ["ms", "s", "m", "h", "d"];

  const [mode, setMode] = useState(modes[0]);
  const modeIdx = modes.indexOf(mode);

  const [interval, setInterval] = useState(0);
  const [intervalUnit, setIntervalUnit] = useState(units[0]);
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

  const { service } = props;
  return (
    <ServiceUI
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
              onChange={setInterval}
              unit={intervalUnit}
              onUnit={setIntervalUnit}
            />
            <div className="flex gap-2">
              <Button className="w-full" variant="outline" onClick={onStart}>
                Start Interval
              </Button>
              <Button className="w-full" variant="outline" onClick={onStop}>
                Stop Interval
              </Button>
            </div>
          </div>
        </OneOfVisible>
      </div>
    </ServiceUI>
  );
}
