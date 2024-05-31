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
import BoardService from "../services/BoardService";

// Emerging concepts
import KeyHandlerDescriptor from "../services/KeyHandler";
import ReactorDescriptor from "../services/Reactor";
import HtmlDescriptor from "../services/Html";
import ArrayTransformDescriptor from "../services/ArrayTransform";
import TimelineDescriptor from "../services/Timeline";
import ChunkedFileProviderDescriptor from "../services/ChunkedFileProvider";
import FeedbackProviderDesriptor from "../services/FeedbackProvider";
import FeedbackTakerDesriptor from "../services/FeedbackTaker";

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

import { ServiceModule } from "../../../types";

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
  FeedbackProviderDesriptor,
  FeedbackTakerDesriptor,

  // cloud
  CloudSinkDescriptor,
  CloudSourceDescriptor,

  BoardService,
  PeerSocket,

  //DEPRECATED
  /*
  import SwitchDescriptor from "../services/Switch";
  import FileSourceDescriptor from "../services/FileSource";
  import RemoteWindowDescriptor from "../services/RemoteWindow";
  */

  // UNSURE
  /*
  import StateDescriptor from "../services/State";
  */
];

export const defaultBundles = [
  "hookup.to/registry/browser/Audio",
  "hookup.to/registry/browser/Graphic",
  "hookup.to/registry/browser/FileStorage",
  "hookup.to/registry/browser/Crypto",
  "hookup.to/registry/browser/TensorFlow",
  "hookup.to/registry/browser/Fileformat",
];
