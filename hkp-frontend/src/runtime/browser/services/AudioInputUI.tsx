import { Component } from "react";
import { Mic, AudioLines } from "lucide-react";

import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";

import AudioDeviceSettings, { AudioInputDevice } from "./AudioDeviceSettings";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";
import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";
import OneOfVisible from "hkp-frontend/src/ui-components/OneOfVisible";
import NumberInput from "hkp-frontend/src/ui-components/NumberInput";
import CustomDialog from "hkp-frontend/src/ui-components/CustomDialog";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import HoldableButton from "hkp-frontend/src/components/shared/HoldableButton";
import WaveformDisplay from "./WaveformDisplay";

type State = {
  showAudioSettings: boolean;
  recording: boolean;
  visualize: boolean;
  devices: Array<AudioInputDevice>;
  timeslice: number;
  pushRecording: boolean;
  recordingMode: string;
  stream: MediaStream | undefined;
};

const recordingModeOptions = ["On Push", "Time Slices"];

export default class AudioInputUI extends Component<ServiceUIProps, State> {
  state: State = {
    showAudioSettings: false,
    recording: false,
    visualize: true,
    devices: [],
    timeslice: 1000,
    pushRecording: false,
    recordingMode: recordingModeOptions[0],
    stream: undefined,
  };

  onInit = (initialState: any) => {
    const { timeslice, availableDevices } = initialState;
    this.setState({
      devices: availableDevices,
      timeslice,
    });
  };

  onNotification = (notification: any) => {
    const { isRecording, timeslice, availableDevices, stream } = notification;

    if (isRecording !== undefined) {
      this.setState({ recording: isRecording });
    }

    if (timeslice !== undefined) {
      this.setState({ timeslice });
    }

    if (availableDevices !== undefined) {
      this.setState({ devices: availableDevices });
    }

    if (stream !== undefined) {
      this.setState({ stream });
    }
  };

  onRecord = () => {
    const { service } = this.props;
    const { recording } = this.state;
    if (recording) {
      service.configure({ command: { action: "stop-recording" } });
    } else {
      service.configure({
        command: {
          action: "start-recording",
          params: { timeslice: service.timeslice },
        },
      });
    }
  };

  onStartPushRecording = () => {
    this.props.service.configure({
      command: { action: "start-recording" },
    });
    this.setState({ pushRecording: true });
  };

  onStopPushRecording = () => {
    this.props.service.configure({ command: { action: "stop-recording" } });
    this.setState({ pushRecording: false });
  };

  renderMain = (service: ServiceInstance) => {
    const { recording, timeslice, recordingMode } = this.state;
    return (
      <div className="flex flex-col text-left mx-5 h-full">
        <WaveformDisplay
          active={this.state.visualize}
          stream={this.state.stream}
        />

        <RadioGroup
          title="Recording Mode"
          options={recordingModeOptions}
          value={recordingMode}
          onChange={(newMode) => this.setState({ recordingMode: newMode })}
        />

        <OneOfVisible current={recordingModeOptions.indexOf(recordingMode)}>
          <div className="py-4 h-full">
            <HoldableButton
              style={{ width: "100%", height: "100%" }}
              onDown={this.onStartPushRecording}
              onUp={this.onStopPushRecording}
            >
              {!this.state.pushRecording ? "Push to Record" : "Recording ..."}
            </HoldableButton>
          </div>

          <div className="mt-1 flex flex-col gap-2">
            <div className="flex">
              <NumberInput
                title="Timeslice"
                value={timeslice}
                onChange={(newSlice) =>
                  service.configure({ timeslice: Number(newSlice) })
                }
              >
                milliseconds
              </NumberInput>
            </div>
            <Button className="hkp-svc-btn" variant="outline" onClick={this.onRecord}>
              {recording ? "Stop Recording" : "Start Sliced Recording"}
            </Button>
          </div>
        </OneOfVisible>
      </div>
    );
  };

  onAudioSettingsDialog = (isOpen: boolean) => {
    this.setState({ showAudioSettings: isOpen });
  };

  onToggleWaveform = () => this.setState({ visualize: !this.state.visualize });

  onActivateDevice = async (device: AudioInputDevice) => {
    const { service } = this.props;
    await service.configure({ device });
    this.setState({ stream: service._stream, showAudioSettings: false });
  };

  render() {
    const { service } = this.props;
    const { showAudioSettings, visualize, devices } = this.state;
    const customMenuEntries = [
      {
        name: `${showAudioSettings ? "Hide" : "Show"} Audio Settings`,
        icon: <MenuIcon icon={Mic} />,
        onClick: () => this.setState({ showAudioSettings: !showAudioSettings }),
      },
      {
        name: `${visualize ? "Disable" : "Enable"} Waveform`,
        icon: <MenuIcon icon={AudioLines} />,
        onClick: this.onToggleWaveform,
      },
    ];

    return (
      <ServiceUI
        {...this.props}
        customMenuEntries={customMenuEntries}
        onInit={this.onInit}
        onNotification={this.onNotification}
        initialSize={{ width: 440, height: 270 }}
      >
        <>
          {this.renderMain(service)}
          <CustomDialog
            title="Audio Input Settings"
            isOpen={showAudioSettings}
            onOpenChange={this.onAudioSettingsDialog}
          >
            <AudioDeviceSettings
              devices={devices}
              onActivate={this.onActivateDevice}
            />
          </CustomDialog>
        </>
      </ServiceUI>
    );
  }
}
