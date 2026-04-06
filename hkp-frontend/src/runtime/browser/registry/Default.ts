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

// Optimization
import GeneticDescriptor from "../services/Genetic";

// Data analysis
import MapDescriptor from "../services/Map";
import GroupByDescriptor from "../services/GroupBy";
import FilterDescriptor from "../services/Filter";
import ReduceDescriptor from "../services/Reduce";
import StatsDescriptor from "../services/Stats";
import SelectDescriptor from "../services/Select";

// Data  Accumulators
import AggregatorDescriptor from "../services/Aggregator";
import BufferDescriptor from "../services/Buffer";
import CacheDescriptor from "../services/Cache";

// Sensors
import XYPadDecriptor from "../services/XYPad";
import CameraDesriptor from "../services/Camera";
import TriggerPadDescriptor from "../services/TriggerPad";

// Actor
import CanvasDescriptor from "../services/Canvas";
import MediaPlayer from "../services/MediaPlayer";

// Structure / Containers
import DispatcherDesriptor from "../services/Dispatcher";
import StackDescriptor from "../services/Stack";
import SequencerDescriptor from "../services/Sequencer";

// Flows and Composites
import BoardService from "../services/BoardService";
import OllamaHackerComposite from "../services/OllamaHackerComposite";

// Emerging concepts
import KeyHandlerDescriptor from "../services/KeyHandler";
import ReactorDescriptor from "../services/Reactor";
import HtmlDescriptor from "../services/Html";
import ArrayTransformDescriptor from "../services/ArrayTransform";
import TimelineDescriptor from "../services/Timeline";
import ChunkedFileProviderDescriptor from "../services/ChunkedFileProvider";

// 3rd party APIs
import SpotifyDescriptor from "../services/Spotify";
import GithubSourceDescriptor from "../services/GithubSource";
import GithubSinkDescriptor from "../services/GithubSink";

// Cloud services
import CloudSinkDescriptor from "../services/CloudSink";
import CloudSourceDescriptor from "../services/CloudSource";

// Random
import UuidGeneratorDescriptor from "../services/UuidGenerator";

import PeerSocket from "../services/PeerSocket";
import OllamaPrompt from "../services/OllamaPrompt";
import OpenAIPrompt from "../services/OpenAIPrompt";
import SpeechSynth from "../services/SpeechSynth";
import LocalStorage from "../services/LocalStorage";
import Looper from "../services/Looper";

import Analyzer from "../services/Analyzer";
import FFT from "../services/FFT";
import Moog from "../services/Moog";
import Delay from "../services/Delay";
import WorkflowBoardBuilder from "../services/WorkflowBoardBuilder";

import { ServiceModule } from "../../../types";
import AudioEditor from "../services/AudioEditor";
import QrCodeDescriptor from "../services/QrCode";
import ImagePickerDescriptor from "../services/ImagePicker";
import HTTPUploaderDescriptor from "../services/HTTPUploader";
import BrowserSubServiceDescriptor from "../services/BrowserSubService";
import LZCompressDescriptor from "../services/LZCompress";

// Modules with additional dependencies
// import GeneticOptimizerDescriptor from "../services/GeneticOptimizer";
// import DownloaderDescriptor from "../services/Downloader";

export const defaultRegistry: Array<ServiceModule> = [
  TimerDescriptor,
  MonitorDescriptor,

  UuidGeneratorDescriptor,

  // Data I/O
  InputDescriptor,
  OutputDescriptor,
  InjectorDescriptor,
  FetcherDesriptor,
  //DownloaderDescriptor,

  // Optimization
  GeneticDescriptor,

  // Actor
  CanvasDescriptor,
  MediaPlayer,

  // Analysis
  MapDescriptor,
  FilterDescriptor,
  ReduceDescriptor,
  StatsDescriptor,
  SelectDescriptor,
  GroupByDescriptor,

  // Accumulation
  BufferDescriptor,
  AggregatorDescriptor,
  CacheDescriptor,

  // Structure / Containers
  DispatcherDesriptor,
  SequencerDescriptor,
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
  KeyHandlerDescriptor,
  ReactorDescriptor,
  HtmlDescriptor,
  ArrayTransformDescriptor,
  TimelineDescriptor,
  ChunkedFileProviderDescriptor,

  // cloud
  CloudSinkDescriptor,
  CloudSourceDescriptor,

  PeerSocket,
  OllamaPrompt,
  OpenAIPrompt,
  SpeechSynth,
  LocalStorage,

  // Flows and Composites
  BoardService,
  OllamaHackerComposite,

  Looper,
  Analyzer,
  FFT,
  Moog,
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
