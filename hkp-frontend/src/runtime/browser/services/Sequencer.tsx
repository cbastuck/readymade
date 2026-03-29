import React, { useState } from "react";

import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";

const serviceId = "hookup.to/service/sequencer";
const serviceName = "Sequencer";

function resolveTransferItem(dataTransferItem: DataTransferItem): Promise<{ type: string; kind: string; data: string }> {
  return new Promise((resolve) => {
    const { kind, type } = dataTransferItem;
    dataTransferItem.getAsString((str: string) =>
      resolve({
        type,
        kind,
        data: str,
      })
    );
  });
}

type StepProps = {
  active: boolean;
  onClick: () => void;
  onData: (data: any) => void;
  data?: any;
  position?: number;
};

function Step(props: StepProps): JSX.Element {
  const { active, onClick, onData } = props;

  const allowDrop = (_ev: React.DragEvent): boolean => true; // TODO: allow everything

  const onDrop = async (ev: React.DragEvent): Promise<any> => {
    for (let i = 0; i < ev.dataTransfer.items.length; ++i) {
      const item = ev.dataTransfer.items[i];
      return await resolveTransferItem(item); // TODO: returning the first item
    }
    return true;
  };

  return (
    <div
      style={{
        backgroundColor: active ? "lightgray" : "white",
        border: active ? "solid 1px white" : "solid 1px gray",
        width: 50,
        height: 50,
      }}
      onClick={onClick}
      onDragOver={(ev: React.DragEvent) => allowDrop(ev) && ev.preventDefault()}
      onDrop={async (ev: React.DragEvent) => {
        ev.preventDefault();
        const data = await onDrop(ev);
        onData(data);
      }}
    ></div>
  );
}

export function SequencerUI(props: any): JSX.Element {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [numSteps, setNumSteps] = useState<number | string>("");
  const [repeat, setRepeat] = useState<boolean>(false);
  const [editBuffer, setEditBuffer] = useState<string>("");
  const [editBufferStep, setEditBufferStep] = useState<number>(0);

  const onInit = (initialState: { currentStep: number; steps: any[]; repeat: boolean }): void => {
    setCurrentStep(initialState.currentStep);
    setNumSteps(initialState.steps.length);
    setRepeat(initialState.repeat);
    setEditBuffer(JSON.stringify(initialState.steps[initialState.currentStep]));
    setEditBufferStep(initialState.currentStep);
  };

  const update = (service: any, { currentStep: cs, finished }: { currentStep?: number; finished?: boolean }): void => {
    if (cs !== undefined) {
      setCurrentStep(cs);
    }

    if (finished === true) {
      service.app.sendAction({ finished: true });
    } else {
      const step = service.steps[cs!];
      // checkpoints should be the first element of array steps
      const checkpoint = Array.isArray(step)
        ? step[0].checkpoint
        : step.checkpoint;
      if (checkpoint) {
        service.app.sendAction({ checkpoint });
      }
    }
  };

  const renderStepBar = (service: any): JSX.Element => {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          marginBottom: 10,
        }}
      >
        {numSteps !== "" &&
          new Array(Number(numSteps))
            .fill({})
            .map((stepData: any, idx: number) => (
              <Step
                key={`step-${idx}`}
                data={stepData}
                position={idx}
                active={currentStep === idx}
                onClick={() => {
                  service.setCurrentStep(idx);
                  setEditBuffer(JSON.stringify(service.steps[idx]));
                  setEditBufferStep(idx);
                }}
                onData={(data: any) => service.setStepData(idx, data)}
              />
            ))}
      </div>
    );
  };

  const renderSteps = (service: any): JSX.Element | false => {
    return (
      service &&
      service.register(update.bind(null, service)) && (
        <div>
          {renderStepBar(service)}
          <div>
            <input
              type="number"
              value={numSteps}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setNumSteps(e.target.value);
              }}
              onBlur={() => {
                const ns = Number(numSteps);
                if (!Number.isNaN(ns)) {
                  service.configure({ numSteps: ns });
                }
              }}
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <input
              type="checkbox"
              checked={repeat}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setRepeat(e.target.checked);
                service.configure({ repeat: e.target.checked });
              }}
            />
          </div>
        </div>
      )
    );
  };

  const renderStepConfig = (service: any): JSX.Element => {
    return (
      <div>
        {renderStepBar(service)}
        <textarea
          style={{ width: "100%" }}
          value={editBuffer}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setEditBuffer(e.target.value)
          }
        />
        <button
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => {
            service.steps[editBufferStep] = JSON.parse(editBuffer);
          }}
        >
          Update Step
        </button>
      </div>
    );
  };

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      segments={[
        { name: "Steps", render: renderSteps },
        { name: "Edit", render: renderStepConfig },
      ]}
    />
  );
}

type Condition = {
  operation: string;
  property: string;
  value: any;
  index?: number;
  weak?: boolean;
};

class Sequencer {
  uuid: string;
  board: any;
  app: any;
  steps: any[];
  currentStep: number;
  repeat: boolean;
  callback?: (data: { currentStep?: number; finished?: boolean }) => void;
  conditions?: (Condition | null | undefined)[];

  constructor(app: any, board: any, _descriptor: any, id: string) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.steps = [{ step: 1 }, { step: 2 }, { step: 3 }];
    this.currentStep = 0;
    this.repeat = true;
  }

  register(callback: (data: { currentStep?: number; finished?: boolean }) => void): boolean {
    this.callback = callback;
    return true;
  }

  setCurrentStep(step: number): void {
    this.currentStep = step;
    if (this.callback) {
      this.callback({ currentStep: this.currentStep });
    }
  }

  setStepData(step: number, data: any): void {
    this.steps[step] = data;
  }

  configure(config: { numSteps?: number; steps?: any[]; repeat?: boolean; conditions?: (Condition | null | undefined)[]; currentStep?: number } | null | undefined): void {
    const { numSteps, steps, repeat, conditions, currentStep } = config || {};

    if (steps !== undefined) {
      this.steps = steps;
    }

    if (repeat !== undefined) {
      this.repeat = repeat;
    }

    if (conditions !== undefined) {
      this.conditions = conditions;
    }

    if (currentStep !== undefined) {
      this.setCurrentStep(currentStep);
    }

    if (numSteps !== undefined) {
      if (this.steps.length >= numSteps) {
        this.steps = this.steps.slice(0, numSteps);
      } else {
        while (this.steps.length < numSteps) {
          this.steps.push({});
        }
      }
    }
  }

  checkCondition(input: any, condition: Condition): boolean {
    const op = condition.operation;
    const value = input[condition.property];
    const referenceValue = condition.value;
    switch (op) {
      case "less":
        return value < referenceValue;
      case "greater":
        return value > referenceValue;
      default:
        break;
    }
    return false;
  }

  process(params: any): any {
    if (!this.repeat && this.currentStep >= this.steps.length) {
      if (this.callback) {
        this.callback({ finished: true });
      }
      return undefined;
    }

    const n = this.currentStep % this.steps.length;
    if (this.conditions) {
      const condition = this.conditions[this.currentStep];
      const nextNonWeakCondition =
        condition &&
        condition.weak &&
        this.conditions.find((next, nextIndex) => {
          if (nextIndex <= this.currentStep) {
            return false;
          }
          if (!next) {
            return true; // unconditional (empty/undefined) steps are not weak
          }
          return !next.weak;
        });
      const conditionFulfilled =
        condition &&
        this.checkCondition(
          condition.index !== undefined ? params[condition.index] : params,
          condition
        );
      const nonWeakConditionFulfilled =
        nextNonWeakCondition &&
        this.checkCondition(
          nextNonWeakCondition.index !== undefined
            ? params[nextNonWeakCondition.index]
            : params,
          nextNonWeakCondition
        );
      if (nonWeakConditionFulfilled) {
        this.currentStep = this.conditions.indexOf(nextNonWeakCondition) + 1;
      } else if (conditionFulfilled) {
        ++this.currentStep;
      }
    } else {
      ++this.currentStep;
    }

    if (this.callback) {
      this.callback({ currentStep: n });
    }

    if (this.steps[n] === undefined) {
      return params;
    }

    // TODO: mix the result with incoming params
    if (Array.isArray(params)) {
      return params.concat(this.steps[n]);
    } else {
      return this.steps[n];
    }
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: any, board: any, _descriptor: any, id: string) =>
    new Sequencer(app, board, _descriptor, id),
  createUI: SequencerUI,
};

export default descriptor;
