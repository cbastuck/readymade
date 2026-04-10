// Atoms
import TimerDescriptor from "../services/Timer";
import MonitorDescriptor from "../services/Monitor";

// Script
import ConsideredHacker from "../services/ConsideredHacker";
import DangerousHacker from "../services/DangerousHacker";

// Data I/O
import InputDescriptor from "../services/Input";
import OutputDescriptor from "../services/Output";
import FetcherDesriptor from "../services/Fetcher";
import InjectorDescriptor from "../services/Injector";

// Data analysis
import MapDescriptor from "../services/Map";
import FilterDescriptor from "../services/Filter";
import SelectDescriptor from "../services/Select";

// Data  Accumulators
import AggregatorDescriptor from "../services/Aggregator";
import CacheDescriptor from "../services/Cache";

// Sensors
import XYPadDecriptor from "../services/XYPad";
import CameraDesriptor from "../services/Camera";
import TriggerPadDescriptor from "../services/TriggerPad";

// Actor
import CanvasDescriptor from "../services/Canvas";

// Structure / Containers
import StackDescriptor from "../services/Stack";

// Flows and Composites
import BoardService from "../services/BoardService";
import OllamaHackerComposite from "../services/OllamaHackerComposite";

// Emerging concepts
import ChunkedFileProviderDescriptor from "../services/ChunkedFileProvider";

// 3rd party APIs
import SpotifyDescriptor from "../services/Spotify";
import GithubSourceDescriptor from "../services/GithubSource";
import GithubSinkDescriptor from "../services/GithubSink";

// Random
import UuidGeneratorDescriptor from "../services/UuidGenerator";

import PeerSocket from "../services/PeerSocket";
import OllamaPrompt from "../services/OllamaPrompt";
import OpenAIPrompt from "../services/OpenAIPrompt";
import SpeechSynth from "../services/SpeechSynth";
import LocalStorage from "../services/LocalStorage";

import Analyzer from "../services/Analyzer";
import FFT from "../services/FFT";
import Delay from "../services/Delay";
import WorkflowBoardBuilder from "../services/WorkflowBoardBuilder";

import { ServiceModule } from "../../../types";
import AudioEditor from "../services/AudioEditor";
import QrCodeDescriptor from "../services/QrCode";
import ImagePickerDescriptor from "../services/ImagePicker";
import HTTPUploaderDescriptor from "../services/HTTPUploader";
import BrowserSubServiceDescriptor from "../services/BrowserSubService";
import LZCompressDescriptor from "../services/LZCompress";

export const defaultRegistry: Array<ServiceModule> = [
  TimerDescriptor,
  MonitorDescriptor,

  UuidGeneratorDescriptor,

  // Data I/O
  InputDescriptor,
  OutputDescriptor,
  InjectorDescriptor,
  FetcherDesriptor,

  // Actor
  CanvasDescriptor,

  // Analysis
  MapDescriptor,
  FilterDescriptor,
  SelectDescriptor,

  // Accumulation
  AggregatorDescriptor,
  CacheDescriptor,

  // Structure / Containers
  StackDescriptor,

  // Sensors
  XYPadDecriptor,
  CameraDesriptor,
  TriggerPadDescriptor,

  // 3rd party APIs
  SpotifyDescriptor,
  GithubSourceDescriptor,
  GithubSinkDescriptor,

  // Scripting
  DangerousHacker,
  ConsideredHacker,

  // emerging
  ChunkedFileProviderDescriptor,

  PeerSocket,
  OllamaPrompt,
  OpenAIPrompt,
  SpeechSynth,
  LocalStorage,

  // Flows and Composites
  BoardService,
  OllamaHackerComposite,
  Analyzer,
  FFT,
  Delay,
  WorkflowBoardBuilder,

  AudioEditor,
  QrCodeDescriptor,
  ImagePickerDescriptor,
  HTTPUploaderDescriptor,
  BrowserSubServiceDescriptor,
  LZCompressDescriptor,
];

export const defaultBundles = [];
