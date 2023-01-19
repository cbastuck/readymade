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

// Structure / Containers
import DispatcherDesriptor from "../services/Dispatcher";
import StackDescriptor from "../services/Stack";
import SequencerDescriptor from "../services/Sequencer";

// Emerging concepts
import KeyHandlerDescriptor from "../services/KeyHandler";
import ReactorDescriptor from "../services/Reactor";
import TimelineDescriptor from "../services/Timeline";
import ChunkedFileProviderDescriptor from "../services/ChunkedFileProvider";
import FeedbackProviderDesriptor from "../services/FeedbackProvider";
import FeedbackTakerDesriptor from "../services/FeedbackTaker";

// 3rd party APIs
import SpotifyDescriptor from "../services/Spotify";
import GithubSourceDescriptor from "../services/GithubSource";
import GithubSinkDescriptor from "../services/GithubSink";

// Modules with additional dependencies
// import GeneticOptimizerDescriptor from "../services/GeneticOptimizer";
// import DownloaderDescriptor from "../services/Downloader";

const defaultRegistry = [
  TimerDescriptor,
  MonitorDescriptor,

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
  TimelineDescriptor,
  ChunkedFileProviderDescriptor,
  FeedbackProviderDesriptor,
  FeedbackTakerDesriptor,
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

export default defaultRegistry;
