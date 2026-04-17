import { ServiceUIComponent } from "../../types";
import MapUI from "./services/MapUI";
import TimerUI from "./services/TimerUI";
import MonitorUI from "./services/MonitorUI";
import CanvasUI from "./services/CanvasUI";
import InputUI from "./services/InputUI";
import StackUI from "./services/StackUI";
import CameraUI from "./services/CameraUI";
import XYPadUI from "./services/XYPadUI";
import AggregatorUI from "./services/AggregatorUI";
import InjectorUI from "./services/InjectorUI";
import HackerUI from "./services/HackerUI";
import SpotifyUI from "./services/SpotifyUI";
import TriggerPadUI from "./services/TriggerPadUI";
import GithubSinkUI from "./services/GithubSinkUI";
import GithubSourceUI from "./services/GithubSourceUI";
import OutputUI from "./services/OutputUI";
import FilterUI from "./services/FilterUI";
import FetcherUI from "./services/FetcherUI";
import OllamaPromptUI from "./services/OllamaPromptUI";
import BrowserSubServiceUI from "./services/BrowserSubServiceUI";
import ImagePickerDescriptor from "./services/ImagePicker";
import ChunkedFileProviderDescriptor from "./services/ChunkedFileProvider";
import AsciiArtDescriptor from "./services/AsciiArt";
import GameOfLifeDescriptor from "./services/GameOfLife";
import GameOfLifeRendererDescriptor from "./services/GameOfLifeRenderer";
import GameOfLifeToNotesDescriptor from "./services/GameOfLifeToNotes";
import GameOfLifeSynthDescriptor from "./services/GameOfLifeSynth";
import HttpRelayClientDescriptor from "./services/HttpRelayClient";

export function findServiceUI(serviceId: string): ServiceUIComponent | null {
  switch (serviceId) {
    case "hookup.to/service/timer":
      return TimerUI;
    case "hookup.to/service/monitor":
      return MonitorUI;
    case "hookup.to/service/canvas":
      return CanvasUI;
    case "hookup.to/service/input":
      return InputUI;
    case "hookup.to/service/trigger-pad":
      return TriggerPadUI;
    case "hookup.to/service/hacker/considered":
    case "hookup.to/service/hacker/dangerous":
      return HackerUI;

    case "hookup.to/service/output":
      return OutputUI;
    case "hookup.to/service/fetcher":
      return FetcherUI;
    case "hookup.to/service/injector":
      return InjectorUI;
    case "hookup.to/service/map":
      return MapUI;
    case "hookup.to/service/stack":
      return StackUI;
    case "hookup.to/service/filter":
      return FilterUI;
    case "hookup.to/service/aggregator":
      return AggregatorUI;
    case "hookup.to/service/buffer":
      return XYPadUI;
    case "hookup.to/service/camera":
      return CameraUI;

    case "hookup.to/service/spotify":
      return SpotifyUI;
    case "hookup.to/service/github-source":
      return GithubSourceUI;
    case "hookup.to/service/github-sink":
      return GithubSinkUI;
    case "hookup.to/service/ollama-prompt":
      return OllamaPromptUI;
    case "sub-service":
      return BrowserSubServiceUI;
    case "hookup.to/service/image-picker":
      return ImagePickerDescriptor.createUI as unknown as ServiceUIComponent;
    case "hookup.to/service/chunked-file-provider":
      return ChunkedFileProviderDescriptor.createUI as unknown as ServiceUIComponent;
    case "hookup.to/service/ascii-art":
      return AsciiArtDescriptor.createUI as unknown as ServiceUIComponent;
    case "hookup.to/service/game-of-life":
      return GameOfLifeDescriptor.createUI as unknown as ServiceUIComponent;
    case "hookup.to/service/game-of-life-renderer":
      return GameOfLifeRendererDescriptor.createUI as unknown as ServiceUIComponent;
    case "hookup.to/service/game-of-life-notes":
      return GameOfLifeToNotesDescriptor.createUI as unknown as ServiceUIComponent;
    case "hookup.to/service/game-of-life-synth":
      return GameOfLifeSynthDescriptor.createUI as unknown as ServiceUIComponent;
    case "hookup.to/service/http-relay-client":
      return HttpRelayClientDescriptor.createUI as unknown as ServiceUIComponent;
    default:
      return null;
  }
}
