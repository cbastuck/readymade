import { Component, FunctionComponent, createElement } from "react";

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
*/

import IngressUI from "./components/services/IngressUI";
import OutputUINode from "./components/services/OutputUI";
import WebsocketUI from "./components/services/WebsocketUI";

import PlaceholderUI from "./runtime/services/PlaceholderUI";
import { ServiceImpl } from "./types";
import { TimerUI } from "./runtime/services/Timer";
import { MonitorUI } from "./runtime/services/Monitor";
import { HackerUI } from "./runtime/services/Hacker";
import { InputUI } from "./runtime/services/Input";
import { OutputUI } from "./runtime/services/Output";
import { FetcherUI } from "./runtime/services/Fetcher";
import { InjectorUI } from "./runtime/services/Injector";
import { MapUI } from "./runtime/services/Map";
import { FilterUI } from "./runtime/services/Filter";
import { AggregatorUI } from "./runtime/services/Aggregator";
import { BufferUI } from "./runtime/services/Buffer";
import { XYPadUI } from "./runtime/services/XYPad";
import { CameraUI } from "./runtime/services/Camera";
import { TriggerPadUI } from "./runtime/services/TriggerPad";
import { CanvasUI } from "./runtime/services/Canvas";
import { StackUI } from "./runtime/services/Stack";
import { SequencerUI } from "./runtime/services/Sequencer";
import { SpotifyUI } from "./runtime/services/Spotify";
import { GithubSourceUI } from "./runtime/services/GithubSource";
import { GithubSinkUI } from "./runtime/services/GithubSink";
import BrowserRegistry from "./runtime/BrowserRegistry";

export function createPlaceholderUI(service: ServiceImpl) {
  return <PlaceholderUI service={service} />;
}

export function createServiceUI(
  registry: BrowserRegistry,
  board: string,
  service: ServiceImpl,
  runtimeId: string,
  userId: string | undefined = undefined,
  props: any = {}
) {
  const serviceId = service.__descriptor
    ? service.__descriptor.serviceId
    : service.serviceId;

  if (!serviceId) {
    throw new Error(`UIFactory missing serviceId ${JSON.stringify(service)}`);
  }

  const userInterface = findServiceUI(registry, serviceId);
  if (userInterface) {
    return createElement(userInterface, {
      ...props,
      service,
      board,
      runtimeId,
      key: `key-${service.uuid}`,
    });
  } else {
    const params = {
      key: serviceId,
      id: serviceId,
      service,
      board,
      userId,
      ...props,
    };
    switch (serviceId) {
      case "hookup.to/service/output": {
        return <OutputUINode {...params} />;
      }
      case "hookup.to/service/ingress":
        return <IngressUI {...params} />;
      case "hookup.to/service/websocket":
        return <WebsocketUI {...params} />;
      default:
        break;
    }
  }
  return createPlaceholderUI(service);
}

function findServiceUI(
  registry: BrowserRegistry,
  serviceId: string
): typeof Component | FunctionComponent | null {
  switch (serviceId) {
    case "hookup.to/service/timer":
      return TimerUI;
    case "hookup.to/service/monitor":
      return MonitorUI;
    case "hookup.to/service/hacker/considered":
    case "hookup.to/service/hacker/dangerous":
      return HackerUI;
    case "hookup.to/service/input":
      return InputUI;
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
    case "hookup.to/service/canvas":
      return CanvasUI;
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
      break;
  }
  return registry.find(serviceId)?.createUI || null;
}
