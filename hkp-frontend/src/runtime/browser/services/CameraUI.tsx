import { useState, useRef, useEffect } from "react";
import { Video, VideoOff, FlipHorizontal } from "lucide-react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";

import NumberInput from "hkp-frontend/src/ui-components/NumberInput";
import Button from "hkp-frontend/src/ui-components/Button";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";
import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";

export default function CameraUI(props: ServiceUIProps) {
  const [mirror, setMirror] = useState<boolean>(true);
  const [recording, setRecording] = useState<boolean>(false);
  const [width, setWidth] = useState<number>(320);
  const [height, setHeight] = useState<number>(200);
  const [captureFormat, setCaptureFormat] = useState<string>("image/png");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<Array<MediaDeviceInfo>>([]);
  const [currentDevice, setCurrentDevice] = useState<MediaDeviceInfo | null>(null);

  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const widthRef = useRef<number>(320);
  const heightRef = useRef<number>(200);
  const captureFormatRef = useRef<string>("image/png");

  // Keep refs in sync with state for use in callbacks
  useEffect(() => { streamRef.current = stream; }, [stream]);
  useEffect(() => { widthRef.current = width; }, [width]);
  useEffect(() => { heightRef.current = height; }, [height]);
  useEffect(() => { captureFormatRef.current = captureFormat; }, [captureFormat]);

  useEffect(() => {
    return () => {
      stopVideoWithStream(streamRef.current);
    };
  }, []);

  const stopVideoWithStream = (s: MediaStream | null) => {
    if (s) {
      if (s.getTracks) {
        s.getTracks().forEach((track) => track.stop());
      }
      if (s.getVideoTracks) {
        s.getVideoTracks().forEach((track) => track.stop());
      }
      if (videoElementRef.current) {
        videoElementRef.current.srcObject = null;
      }
    }
  };

  const onInit = (initialState: any) => {
    props.service.registerScreenshooter(triggerScreenshot);
    setMirror(initialState.mirror !== undefined ? initialState.mirror : true);
    setRecording(initialState.recording !== undefined ? initialState.recording : false);
    setWidth(initialState.width !== undefined ? initialState.width : 320);
    setHeight(initialState.height !== undefined ? initialState.height : 200);
    setCaptureFormat(initialState.captureFormat !== undefined ? initialState.captureFormat : "image/png");
    setStream(initialState.stream !== undefined ? initialState.stream : null);
    setDevices(initialState.devices !== undefined ? initialState.devices : []);
    setCurrentDevice(initialState.currentDevice !== undefined ? initialState.currentDevice : null);
  };

  const onNotification = (notification: any) => {
    if (needsUpdate(notification.captureFormat, captureFormatRef.current)) {
      setCaptureFormat(notification.captureFormat);
    }
  };

  const enumerateDevices = async () => {
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = allDevices.filter(
      (device) => device.kind === "videoinput"
    );
    setDevices(videoDevices);
    setCurrentDevice(videoDevices[0]);
  };

  const initVideo = async (
    videoElement: HTMLVideoElement,
    deviceId?: string
  ): Promise<MediaStream> => {
    const constraints: MediaStreamConstraints = !deviceId
      ? { video: true }
      : { video: { deviceId } };
    const s = await navigator.mediaDevices.getUserMedia(constraints);

    videoElement.srcObject = s;
    videoElement.play();
    return s;
  };

  const startVideo = async (videoElement: HTMLVideoElement, deviceId?: string) => {
    if (navigator.mediaDevices) {
      const s = await initVideo(videoElement, deviceId);
      setStream(s);
      streamRef.current = s;
      if (!devices.length) {
        await enumerateDevices();
      }
    } else {
      throw new Error("Can not initialize video");
    }
  };

  const stopVideo = () => {
    const s = streamRef.current;
    if (s) {
      stopVideoWithStream(s);
      setStream(null);
      streamRef.current = null;
    }
  };

  const startRecording = (s: MediaStream) => {
    return new Promise((resolve, reject) => {
      recorderRef.current = new MediaRecorder(s);
      const data: Array<any> = [];

      recorderRef.current.ondataavailable = (event) => data.push(event.data);
      recorderRef.current.start();

      recorderRef.current.onstop = () => resolve(data);
      recorderRef.current.onerror = (event) => reject(event);
    });
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  };

  const triggerScreenshot = () => {
    return new Promise<Blob | null>((resolve) => {
      const w = widthRef.current;
      const h = heightRef.current;
      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }
      canvasRef.current.width = w;
      canvasRef.current.height = h;
      const ctx = canvasRef.current.getContext("2d");
      if (ctx && videoElementRef.current) {
        ctx.drawImage(videoElementRef.current, 0, 0, w, h);
        canvasRef.current.toBlob(resolve, captureFormatRef.current);
      }
    });
  };

  const onRecord = () => {
    const s = streamRef.current;
    const newRecording = !recording;
    setRecording(newRecording);
    if (newRecording) {
      if (s) {
        startRecording(s).then((data: any) =>
          props.service.inject(new Blob(data, { type: "video/webm" }))
        );
      }
    } else {
      stopRecording();
    }
  };

  const onSnapshot = () =>
    props.service.configure({ action: "triggerSnapshot" });

  const onChangeDevice = (device: MediaDeviceInfo | null) => {
    stopVideo();
    startVideo(videoElementRef.current!, device?.deviceId);
    setCurrentDevice(device);
  };

  const renderMain = () => {
    const mirrorStyle = mirror && {
      transform: "rotateY(180deg)",
      WebkitTransform: "rotateY(180deg)",
      MozTransform: "rotateY(180deg)",
    };
    const cameraRunning = !!stream;
    return (
      <div className="flex flex-col gap-2 mb-4">
        <div className="py-2">
          <SelectorField
            label="Device"
            options={devices.reduce(
              (all, device) => ({ ...all, [device.label]: device.label }),
              {}
            )}
            value={currentDevice?.label || ""}
            onChange={(value) =>
              onChangeDevice(devices[value.index] || null)
            }
          />
        </div>
        <video
          ref={(videoElement) => {
            if (!videoElementRef.current && videoElement) {
              videoElementRef.current = videoElement;
              startVideo(videoElement);
            } else if (videoElement && videoElementRef.current !== videoElement) {
              videoElementRef.current = videoElement; // happens e.g. on resize
            }
          }}
          className="w-full rounded-lg"
          style={{
            ...mirrorStyle,
          }}
          width={cameraRunning ? width : 0}
          height={cameraRunning ? height : 0}
          autoPlay
        />

        <div className="mt-2">
          <GroupLabel>Capture Resolution</GroupLabel>
          <div className="flex w-full gap-4 px-4 py-2">
            <NumberInput
              className="w-full"
              title="Width"
              value={width}
              onChange={(newValue) => {
                const w = Number(newValue);
                if (!isNaN(w)) {
                  setWidth(w);
                }
              }}
            >
              px
            </NumberInput>

            <NumberInput
              className="w-full"
              title="Height"
              value={height}
              onChange={(newValue) => {
                const h = Number(newValue);
                if (!isNaN(h)) {
                  setHeight(h);
                }
              }}
            >
              px
            </NumberInput>
          </div>
        </div>
        <div className="flex gap-2 w-full">
          <Button
            className="w-full"
            disabled={recording}
            onClick={onSnapshot}
          >
            Capture Snapshot
          </Button>
          <Button className="w-full" disabled={!stream} onClick={onRecord}>
            {recording ? "Stop Video" : "Capture Video"}
          </Button>
        </div>
      </div>
    );
  };

  const cameraRunning = !!stream;
  const customMenuEntries = [
    {
      name: cameraRunning ? "Disable Camera" : "Enable Camera",
      icon: cameraRunning ? (
        <MenuIcon icon={VideoOff} />
      ) : (
        <MenuIcon icon={Video} />
      ),
      disabled: !cameraRunning && !videoElementRef.current,
      onClick: () =>
        cameraRunning
          ? stopVideo()
          : startVideo(videoElementRef.current!),
    },
    {
      name: mirror ? "Unmirror Image" : "Mirror Image",
      icon: <MenuIcon icon={FlipHorizontal} />,
      onClick: () => setMirror(!mirror),
    },
  ];
  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      initialSize={{ width: 480, height: undefined }}
      customMenuEntries={customMenuEntries}
    >
      {renderMain()}
    </ServiceUI>
  );
}
