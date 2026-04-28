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
import BatcherDescriptor from "../services/Batcher";
import SwitchDescriptor from "../services/Switch";
import SelectDescriptor from "../services/Select";

// Data  Accumulators
import AggregatorDescriptor from "../services/Aggregator";
import CacheDescriptor from "../services/Cache";
import BufferDescriptor from "../services/Buffer";
import GroupByDescriptor from "../services/GroupBy";
import MatchFilterDescriptor from "../services/MatchFilter";

// Sensors
import XYPadDecriptor from "../services/XYPad";
import CameraDesriptor from "../services/Camera";
import TriggerPadDescriptor from "../services/TriggerPad";

// Actor
import CanvasDescriptor from "../services/Canvas";
import GameOfLifeDescriptor from "../services/GameOfLife";
import GameOfLifeRendererDescriptor from "../services/GameOfLifeRenderer";
import SortDescriptor from "../services/Sort";
import LimitDescriptor from "../services/Limit";
import FlatMapDescriptor from "../services/FlatMap";
import SmoothDescriptor from "../services/Smooth";

// Structure / Containers
import StackDescriptor from "../services/Stack";

// Flows and Composites
import BoardService from "../services/BoardService";
import OllamaHackerComposite from "../services/OllamaHackerComposite";

// Emerging concepts
import ChunkedFileProviderDescriptor from "../services/ChunkedFileProvider";
import AsciiArtDescriptor from "../services/AsciiArt";
import HttpRelayClientDescriptor from "../services/HttpRelayClient";

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
import MicrophoneMonitorDescriptor from "../services/MicrophoneMonitor";
import DebounceDescriptor from "../services/Debounce";
import StopperDescriptor from "../services/Stopper";
import ConfiguratorDescriptor from "../services/Configurator";
import AudioInputDescriptor from "../services/AudioInput";
import AudioOutputDescriptor from "../services/AudioOutput";
import SoundDescriptor from "../services/Sound";
import GifEncoderDescriptor from "../services/GifEncoder";

// Crypto
import EncryptDescriptor from "../services/Encrypt";
import DecryptDescriptor from "../services/Decrypt";
import HashDescriptor from "../services/Hash";
import SignDescriptor from "../services/Sign";
import StateDescriptor from "../services/State";

// Encoding
import EncodeDescriptor from "../services/Encode";

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
  GifEncoderDescriptor,
  GameOfLifeDescriptor,
  GameOfLifeRendererDescriptor,

  // Analysis
  MapDescriptor,
  FilterDescriptor,
  BatcherDescriptor,
  SelectDescriptor,
  SwitchDescriptor,
  SortDescriptor,
  LimitDescriptor,
  FlatMapDescriptor,
  SmoothDescriptor,

  // Accumulation
  AggregatorDescriptor,
  BufferDescriptor,
  CacheDescriptor,
  GroupByDescriptor,
  MatchFilterDescriptor,

  // Structure / Containers
  StackDescriptor,
  StateDescriptor,

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
  AsciiArtDescriptor,
  HttpRelayClientDescriptor,

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

  // Sensors
  MicrophoneMonitorDescriptor,

  // Flow control
  DebounceDescriptor,
  StopperDescriptor,
  ConfiguratorDescriptor,

  // Audio I/O
  AudioInputDescriptor,
  AudioOutputDescriptor,
  SoundDescriptor,

  // Crypto
  EncryptDescriptor,
  DecryptDescriptor,
  HashDescriptor,
  SignDescriptor,

  // Encoding
  EncodeDescriptor,
];

export const defaultBundles = [];
