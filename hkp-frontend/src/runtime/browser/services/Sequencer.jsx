import React, { Component } from "react";

import ServiceUI from "../../services/ServiceUI";

const serviceId = "hookup.to/service/sequencer";
const serviceName = "Sequencer";

function resolveTransferItem(dataTransferItem) {
  return new Promise((resolve) => {
    const { kind, type } = dataTransferItem;
    dataTransferItem.getAsString((str) =>
      resolve({
        type,
        kind,
        data: str,
      })
    );
  });
}

class Step extends Component {
  allowDrop = (ev) => true; // TODO: allow everything

  onDrop = async (ev) => {
    for (let i = 0; i < ev.dataTransfer.items.length; ++i) {
      const item = ev.dataTransfer.items[i];
      return await resolveTransferItem(item); // TODO: returning the first item
    }
    return true;
  };

  render() {
    const { active, onClick, onData } = this.props;
    return (
      <div
        style={{
          backgroundColor: active ? "lightgray" : "white",
          border: active ? "solid 1px white" : "solid 1px gray",
          width: 50,
          height: 50,
        }}
        onClick={onClick}
        onDragOver={(ev) => this.allowDrop(ev) && ev.preventDefault()}
        onDrop={async (ev) => {
          ev.preventDefault();
          const data = await this.onDrop(ev);
          onData(data);
        }}
      ></div>
    );
  }
}

export class SequencerUI extends Component {
  state = {
    currentStep: 0,
    numSteps: "",
    repeat: false,
    editBuffer: "",
    editBufferStep: 0,
  };

  onInit = (initialState) => {
    this.setState({
      currentStep: initialState.currentStep,
      numSteps: initialState.steps.length,
      repeat: initialState.repeat,
      editBuffer: JSON.stringify(initialState.steps[initialState.currentStep]),
      editBufferStep: initialState.currentStep,
    });
  };

  update = (service, { currentStep, finished }) => {
    if (currentStep !== undefined) {
      this.setState({ currentStep });
    }

    if (finished === true) {
      service.app.sendAction({ finished: true });
    } else {
      const step = service.steps[currentStep];
      // checkpoints should be the first element of array steps
      const checkpoint = Array.isArray(step)
        ? step[0].checkpoint
        : step.checkpoint;
      if (checkpoint) {
        service.app.sendAction({ checkpoint });
      }
    }
  };

  renderSteps = (service) => {
    return (
      service &&
      service.register(this.update.bind(this, service)) && (
        <div>
          {this.renderStepBar(service)}
          <div>
            <input
              type="number"
              label="Steps"
              value={this.state.numSteps}
              onChange={(_, { value }) => {
                this.setState({ numSteps: value });
              }}
              onBlur={() => {
                const numSteps = Number(this.state.numSteps);
                if (!Number.isNaN(numSteps)) {
                  service.configure({ numSteps });
                }
              }}
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <input
              type="checkbox"
              label="Repeat"
              checked={this.state.repeat}
              onChange={(_, { checked }) =>
                this.setState({ repeat: checked }, () =>
                  service.configure({ repeat: checked })
                )
              }
            />
          </div>
        </div>
      )
    );
  };

  renderStepBar = (service) => {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          marginBottom: 10,
        }}
      >
        {this.state.numSteps !== "" &&
          new Array(Number(this.state.numSteps))
            .fill({})
            .map((stepData, idx) => (
              <Step
                key={`step-${idx}`}
                data={stepData}
                position={idx}
                active={this.state.currentStep === idx}
                onClick={() => {
                  service.setCurrentStep(idx);
                  this.setState({
                    editBuffer: JSON.stringify(service.steps[idx]),
                    editBufferStep: idx,
                  });
                }}
                onData={(data) => service.setStepData(idx, data)}
              />
            ))}
      </div>
    );
  };

  renderStepConfig = (service) => {
    return (
      <div>
        {this.renderStepBar(service)}
        <textarea
          style={{ width: "100%" }}
          value={this.state.editBuffer}
          onChange={(_, data) =>
            this.setState({
              editBuffer: data.value,
            })
          }
        />
        <button
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => {
            service.steps[this.state.editBufferStep] = JSON.parse(
              this.state.editBuffer
            );
          }}
        >
          Update Step
        </button>
      </div>
    );
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit.bind(this)}
        segments={[
          { name: "Steps", render: this.renderSteps },
          { name: "Edit", render: this.renderStepConfig },
        ]}
      />
    );
  }
}

class Sequencer {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.steps = [{ step: 1 }, { step: 2 }, { step: 3 }];
    this.currentStep = 0;
    this.repeat = true;
  }

  register(callback) {
    this.callback = callback;
    return true;
  }

  setCurrentStep(step) {
    this.currentStep = step;
    if (this.callback) {
      this.callback({ currentStep: this.currentStep });
    }
  }

  setStepData(step, data) {
    this.steps[step] = data;
  }

  configure(config) {
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

  checkCondition(input, condition) {
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

  process(params) {
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
  create: (app, board, descriptor, id) =>
    new Sequencer(app, board, descriptor, id),
  createUI: SequencerUI,
};

export default descriptor;
