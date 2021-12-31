import timerDescriptor from "../services/Timer";
import monitorDescriptor from "../services/Monitor";
import playbackDescriptor from "../services/Playback";
import FileProviderDescriptor from "../services/FileProvider";
import DownloaderDescriptor from "../services/Downloader";
import SequencerDescriptor from "../services/Sequencer";
import CanvasDescriptor from "../services/Canvas";
import RemoteWindowDescriptor from "../services/RemoteWindow";
import StateDescriptor from "../services/State";
import GeneticDescriptor from "../services/Genetic";
import GeneticOptimizerDescriptor from "../services/GeneticOptimizer";
import StatsDescriptor from "../services/Stats";
import SwitchDescriptor from "../services/Switch";
import BufferDescriptor from "../services/Buffer";
import MapDescriptor from "../services/Map";
import FilterDescriptor from "../services/Filter";
import FeedbackProviderDesriptor from "../services/FeedbackProvider";
import FeedbackTakerDesriptor from "../services/FeedbackTaker";
import FetcherDesriptor from "../services/Fetcher";
import CameraDesriptor from "../services/Camera";
import DispatcherDesriptor from "../services/Dispatcher";
import InputDescriptor from "../services/Input";
import OutputDescriptor from "../services/Output";
import InjectorDescriptor from "../services/Injector";
import TriggerPadDescriptor from "../services/TriggerPad";
import FileSourceDescriptor from "../services/FileSource";
import TimelineDescriptor from "../services/Timeline";
import StackDescriptor from "../services/Stack";
import AggregatorDescriptor from "../services/Aggregator";
import ReduceDescriptor from "../services/Reduce";
import SpotifyDescriptor from "../services/Spotify";
import GithubSourceDescriptor from "../services/GithubSource";
import GithubSinkDescriptor from "../services/GithubSink";
import CacheDescriptor from "../services/Cache";
import KeyHandlerDescriptor from "../services/KeyHandler";
import ReactorDescriptor from "../services/Reactor";
import XYPadDecriptor from "../services/XYPad";

const defaultRegistry = [
  timerDescriptor,
  monitorDescriptor,
  playbackDescriptor,
  FileProviderDescriptor,
  DownloaderDescriptor,
  SequencerDescriptor,
  CanvasDescriptor,
  RemoteWindowDescriptor,
  StateDescriptor,
  GeneticDescriptor,
  GeneticOptimizerDescriptor,
  StatsDescriptor,
  SwitchDescriptor,
  BufferDescriptor,
  MapDescriptor,
  FilterDescriptor,
  FeedbackProviderDesriptor,
  FeedbackTakerDesriptor,
  FetcherDesriptor,
  CameraDesriptor,
  DispatcherDesriptor,
  InputDescriptor,
  OutputDescriptor,
  InjectorDescriptor,
  TriggerPadDescriptor,
  FileSourceDescriptor,
  TimelineDescriptor,
  StackDescriptor,
  AggregatorDescriptor,
  ReduceDescriptor,
  SpotifyDescriptor,
  GithubSourceDescriptor,
  GithubSinkDescriptor,
  CacheDescriptor,
  KeyHandlerDescriptor,
  ReactorDescriptor,
  XYPadDecriptor,
];

export default defaultRegistry;
