import timerDescriptor from "../services/Timer";
import monitorDescriptor from "../services/Monitor";
import SequencerDescriptor from "../services/Sequencer";
import GeneticDescriptor from "../services/Genetic";
import CanvasDescriptor from "../services/Canvas";
import StatsDescriptor from "../services/Stats";
import DispatcherDesriptor from "../services/Dispatcher";

/*
import playbackDescriptor from "../services/Playback";
import FileProviderDescriptor from "../services/FileProvider";
import DownloaderDescriptor from "../services/Downloader";


import RemoteWindowDescriptor from "../services/RemoteWindow";
import StateDescriptor from "../services/State";
import GeneticOptimizerDescriptor from "../services/GeneticOptimizer";

import SwitchDescriptor from "../services/Switch";
import BufferDescriptor from "../services/Buffer";
import MapDescriptor from "../services/Map";
import FilterDescriptor from "../services/Filter";
import FeedbackProviderDesriptor from "../services/FeedbackProvider";
import FeedbackTakerDesriptor from "../services/FeedbackTaker";
import FetcherDesriptor from "../services/Fetcher";
import CameraDesriptor from "../services/Camera";

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
*/

const defaultRegistry = [
  timerDescriptor,
  monitorDescriptor,
  SequencerDescriptor,
  GeneticDescriptor,
  CanvasDescriptor,
  StatsDescriptor,
  DispatcherDesriptor,
  /*
  playbackDescriptor,
  FileProviderDescriptor,
  DownloaderDescriptor,
  
  RemoteWindowDescriptor,
  StateDescriptor,
  
  GeneticOptimizerDescriptor,
  
  SwitchDescriptor,
  BufferDescriptor,
  MapDescriptor,
  FilterDescriptor,
  FeedbackProviderDesriptor,
  FeedbackTakerDesriptor,
  FetcherDesriptor,
  CameraDesriptor,
  
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
  */
];

export default defaultRegistry;
