/*
import HTMLFilterUI  from './components/services/HTMLFilterUI';
import FileExchangeUI from './components/services/FileExchangeUI';
import WebsocketConsumer from './components/services/WebsocketConsumer';
import InputUI from './components/services/InputUI';
import FilterUI from './components/services/FilterUI';
import MySqlResourceUI from './components/services/MySqlResourceUI';
import MySqlServiceUI from './components/services/MySqlServiceUI';
import TimerUI from './components/services/TimerUI';
import WebGetUI from './components/services/WebGetUI';
import DataInjectorUI from './components/services/DataInjectorUI';
import HTMLTemplatesUI from './components/services/HTMLTemplatesUI';
import FileS3UI from './components/services/FileS3UI';
import AggregatorUI from './components/services/AggregatorUI';


import IngressUI from "./components/services/IngressUI";
import OutputUINode from "./components/services/OutputUI";
import WebsocketUI from "./components/services/WebsocketUI";
*/

import PlaceholderUI from "./runtime/browser/services/PlaceholderUI";
import MapUI from "./runtime/browser/services/MapUI";
import TimerUI from "./runtime/browser/services/TimerUI";
import MonitorUI from "./runtime/browser/services/MonitorUI";
import CanvasUI from "./runtime/browser/services/CanvasUI";
import InputUI from "./runtime/browser/services/InputUI";

import { ServiceUIComponent } from "./types";
import { HackerUI } from "./runtime/browser/services/Hacker";

import { OutputUI } from "./runtime/browser/services/Output";
import { FetcherUI } from "./runtime/browser/services/Fetcher";
import { InjectorUI } from "./runtime/browser/services/Injector";

import { FilterUI } from "./runtime/browser/services/Filter";
import { AggregatorUI } from "./runtime/browser/services/Aggregator";
import { BufferUI } from "./runtime/browser/services/Buffer";
import { XYPadUI } from "./runtime/browser/services/XYPad";
import { CameraUI } from "./runtime/browser/services/Camera";
import { TriggerPadUI } from "./runtime/browser/services/TriggerPad";

import { StackUI } from "./runtime/browser/services/Stack";
import { SequencerUI } from "./runtime/browser/services/Sequencer";
import { SpotifyUI } from "./runtime/browser/services/Spotify";
import { GithubSourceUI } from "./runtime/browser/services/GithubSource";
import { GithubSinkUI } from "./runtime/browser/services/GithubSink";
import BrowserRegistry from "./runtime/browser/BrowserRegistry";

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
    case "hookup.to/service/filter":
      return FilterUI;
    case "hookup.to/service/aggregator":
      return AggregatorUI;
    case "hookup.to/service/buffer":
      return BufferUI;
    case "hookup.to/service/xy-pad":
      return XYPadUI;
    case "hookup.to/service/camera":
      return CameraUI;
    case "hookup.to/service/trigger-pad":
      return TriggerPadUI;
    case "hookup.to/service/stack":
      return StackUI;
    case "hookup.to/service/sequencer":
      return SequencerUI;
    case "hookup.to/service/spotify":
      return SpotifyUI;
    case "hookup.to/service/github-source":
      return GithubSourceUI;
    case "hookup.to/service/github-sink":
      return GithubSinkUI;
    default:
      return null;
  }
}
