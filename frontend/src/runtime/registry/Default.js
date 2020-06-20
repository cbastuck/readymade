import timerDescriptor from '../services/Timer';
import monitorDescriptor from '../services/Monitor';
//import microphoneDescriptor from './services/MicrophoneOld';
import microphoneDescriptor from '../services/Microphone';
import mp3Encoder from '../services/MP3Encoder';
import playbackDescriptor from '../services/Playback';
import FileProviderDescriptor from '../services/FileProvider';
import DownloaderDescriptor from '../services/Downloader';
import PlotterDescriptor from '../services/Plotter';
import SequencerDescriptor from '../services/Sequencer';
import CanvasDescriptor from '../services/Canvas';
import ThreeViewersDescriptor from '../services/ThreeViewer';
import RemoteWindowDescriptor from '../services/RemoteWindow';
import StateDescriptor from '../services/State';
import GeneticDescriptor from '../services/Genetic';
import GeneticOptimizerDescriptor from '../services/GeneticOptimizer';
import StatsDescriptor from '../services/Stats';
import SwitchDescriptor from '../services/Switch';
import SamplingDescriptor from '../services/Sampling';
import BufferDescriptor from '../services/Buffer';
import MapDescriptor from '../services/Map';
import FilterDescriptor from '../services/Filter';
import FeedbackProviderDesriptor from '../services/FeedbackProvider';
import FeedbackTakerDesriptor from '../services/FeedbackTaker';
import FetcherDesriptor from '../services/Fetcher';
import CameraDesriptor from '../services/Camera';
import DispatcherDesriptor from '../services/Dispatcher';
import InputDescriptor from '../services/Input';

export default [
  timerDescriptor,
  monitorDescriptor,
  microphoneDescriptor,
  playbackDescriptor,
  mp3Encoder,
  FileProviderDescriptor,
  DownloaderDescriptor,
  PlotterDescriptor,
  SequencerDescriptor,
  CanvasDescriptor,
  ThreeViewersDescriptor,
  RemoteWindowDescriptor,
  StateDescriptor,
  GeneticDescriptor,
  GeneticOptimizerDescriptor,
  StatsDescriptor,
  SwitchDescriptor,
  SamplingDescriptor,
  BufferDescriptor,
  MapDescriptor,
  FilterDescriptor,
  FeedbackProviderDesriptor,
  FeedbackTakerDesriptor,
  FetcherDesriptor,
  CameraDesriptor,
  DispatcherDesriptor,
  InputDescriptor,
];