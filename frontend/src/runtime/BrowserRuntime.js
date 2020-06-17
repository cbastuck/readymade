import EventSource from 'eventsource';
import { decode } from 'base64-arraybuffer';

import timerDescriptor from './services/Timer';
import monitorDescriptor from './services/Monitor';
//import microphoneDescriptor from './services/MicrophoneOld';
import microphoneDescriptor from './services/Microphone';
import mp3Encoder from './services/MP3Encoder';
import playbackDescriptor from './services/Playback';
import FileProviderDescriptor from './services/FileProvider';
import DownloaderDescriptor from './services/Downloader';
import PlotterDescriptor from './services/Plotter';
import SequencerDescriptor from './services/Sequencer';
import CanvasDescriptor from './services/Canvas';
import ThreeViewersDescriptor from './services/ThreeViewer';
import RemoteWindowDescriptor from './services/RemoteWindow';
import StateDescriptor from './services/State';
import GeneticDescriptor from './services/Genetic';
import GeneticOptimizerDescriptor from './services/GeneticOptimizer';
import StatsDescriptor from './services/Stats';
import SwitchDescriptor from './services/Switch';
import SamplingDescriptor from './services/Sampling';
import BufferDescriptor from './services/Buffer';
import MapDescriptor from './services/Map';
import FilterDescriptor from './services/Filter';
import FeedbackProviderDesriptor from './services/FeedbackProvider';
import FeedbackTakerDesriptor from './services/FeedbackTaker';
import FetcherDesriptor from './services/Fetcher';
import CameraDesriptor from './services/Camera';
import DispatcherDesriptor from './services/Dispatcher';
import InputDescriptor from './services/Input';
import { request } from '../core/actions';
import { parseResponse } from './MultiformParser';

import { restoreToken } from '../core/Auth';
import { serializeWebsocketBuffer } from '../core/format';

function logInfo(msg) {
  console.log(msg);
}

export default class BrowserRuntime {
  static registry() {
    return [
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
  }

  constructor(runtime, { board, userId } = {}) {
    this.registry = BrowserRuntime.registry();

    this.id = runtime.id;
    this.name = runtime.name;
    this.services = runtime.services || [];
    this.app = {
      next: this.next,
      getServiceById: id => this.services.find(s => s.uuid === id),
    }

    if (board) {
      this.board = board;
    }

    if (userId) {
      this.userId = userId;
    }
    
    if (runtime.sendResult) {
      this.sendResult = runtime.sendResult;
    }
  }

  next = async (service, params, requestId=null, advanceBeforeProcess=true) => {
    const position = this.services.findIndex(s => s === service);
    if (position === -1) {
      return console.error('Called next() in browser but could not find current service', service);
    }

    let svc = this.services[position];
    let result = params;
    for (let i = advanceBeforeProcess ? position+1 : position; !!this.services[i]; ++i) {
      svc = this.services[i];
      result = await svc.process(params);
      params = result;
    }
    await this.sendResult(svc.uuid, result, requestId);
    return result;
  }

  connect(id) {
    this.id = id; // TODO: do we need this? Already done in c'tor
    const backendPath = `/api/${this.userId}/${this.board}/${id}`;
    logInfo(`Connecting ${this.name} to ${backendPath}`);
    
    const useWebSockets = true;
    if (useWebSockets) {
      // TODO: assume coordinator is on the same host as frontend
      const backendHost = window.location.host; 
      this.connectRuntimeViaWebSocket(backendHost, backendPath);
    } else {
      this.connectRuntimeViaEventSource(backendPath);
    }
  }

  connectRuntimeViaWebSocket(backendHost, backendPath) {
    function rebuild(json, message) {
      return Object.keys(json).reduce(
        (acc, key) => {
          const value = json[key];
          if (typeof value === 'object') {
            return { ...acc, [key]: rebuild(value, message) };
          }
          if (value.startsWith && value.startsWith('+binary-data-@')) {
            const blob = new Blob(
              [message[value].payload],
              { type : message[value].headers['content-type'] },
            );
            return { ...acc, [key]: blob };
          } else {
            return { ...acc, [key]: value };
          }
        },
        {}
      );
    }

    this.websocket = new WebSocket(`ws://${backendHost}${backendPath}`, restoreToken());
    this.websocket.binaryType = 'arraybuffer';
    this.websocket.onmessage = event => {
      const message = parseResponse(event.data);
      const action = message.json ? rebuild(message.json.payload, message) : JSON.parse(message);
      logInfo(`Received on ${this.id} (${this.name})`, action);
      this.onMessage(action);
    };
    this.websocket.onclose = event => {
      logInfo(`Closed WebSocket with ${this.id}`);
    };
    this.websocket.onerror = function(error) {
      console.error(`WebSocket ${this.id} Error: `, error);
    };

    this.websocket.onopen = event => {
      logInfo(`WebSocket to ${this.id} is open`);
    }
  }

  connectRuntimeViaEventSource(backendPath) {
    this.eventSource = new EventSource(backendPath);
    
    const onMessage = e => this.onMessage(e.data ? JSON.parse(e.data) : e);
    const onError = error => {
      if (error.status === 504) { // HTTP Gateway Timeout 
        this.eventSource.removeEventListener('data', onMessage);
        this.eventSource.removeEventListener('error', onError);
        this.eventSource = undefined;
        logInfo(`Reconnecting browser runtime ${error} - ${error.status}`);
        setTimeout(() => this.connect(this.id), 1000);
        return;
      } else {
        console.error('Unknown error in BrowserRuntime', error);
      }
    }
    this.eventSource.addEventListener(
      'data',
      onMessage
    );
    this.eventSource.addEventListener(
      'error',
      onError
    );
  }

  onMessage(command) {
    switch (command.action) {
      case 'create':
        return this.createService(command.descriptor, command.uuid, command.initialConfig);
      case 'config':
        return this.configureService(command.uuid, command.config);
      case 'process':
        return this.processService(command.uuid, command.params, command.requestId);
      case 'destroy':
        return this.destroyService(command.uuid);
      case 'ping':
        return;
      default:
        console.error('Unknown action in browser runtime: ', command);
    }
  }

  async sendResult(serviceUuid, data, requestId) {
    if (!this.id) {
      return console.error('Could not send result data, no backend is connected');
    }

    if (this.websocket) { // send the result via websocket
      const buffer = await serializeWebsocketBuffer(
        data, 
        {
          board: this.board,
          userId: this.userId,
          serviceUuid,
          requestId,
        }
      );
      this.websocket.send(buffer);
      return null;
    } else { // ... or as post
      return request(`${this.userId}/${this.board}/${this.id}/${requestId}`, 'POST', false, data);
    }
  }

  createService({ serviceId, board }, id, initialConfig) {
    const descriptor = this.registry.find(elem => elem.serviceId === serviceId);
    if (descriptor) {
      const service = descriptor.create(this.app, board, descriptor, id);
      if (initialConfig) {
        service.configure(initialConfig);
      }
      this.services.push(service);
      return service;
    }
  }

  configureService(uuid, config) {
    const service = this.services.find(s => s.uuid = uuid);
    if (!service) {
      return console.error(`Could not find browser service to configure: ${uuid} in ${JSON.stringify(this.services)}`);
    }
    service.configure(config);
  }

  async processService(uuid, params, requestId) {
    const position = this.services.findIndex(s => s.uuid = uuid);
    if (position === -1) {
      return console.error(`Could not find browser service to process: ${uuid} in ${JSON.stringify(this.services)}`);
    }
    
    // if it's not an object it's a binary buffer base64 encoded
    const data = typeof params === 'string' ?
      new Blob(
        [decode(params)], 
        { type: 'application/octet-binary' }
      ) :
      params;

    const service = this.services[position];
    return this.next(service, data, requestId, false);
  }

  destroyService(uuid) {
    const service = this.services.find(s => s.uuid = uuid);
    if (!service) {
      return console.error(`Could not find browser service to process: ${uuid} in ${JSON.stringify(this.services)}`);
    }
    service.destroy && service.destroy();
  }

  getServiceById(uuid) {
    return this.services.find(s => s.uuid === uuid);
  }

  destroyRuntime() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
  }
};