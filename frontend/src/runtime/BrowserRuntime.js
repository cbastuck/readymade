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
import { request } from '../core/actions';

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
    ];
  }

  constructor(runtime) {
    this.registry = BrowserRuntime.registry();

    this.id = runtime.id;
    this.name = runtime.name;
    this.services = runtime.services || [];
    this.app = {
      next: this.next
    }

    if (runtime.sendResult) {
      this.sendResult = runtime.sendResult;
    }
  }

  next = async (service, params, requestId=null, advanceBeforeProcess=true) => {
    const position = this.services.findIndex(s => s === service);
    if (position === -1) {
      return console.log('Called next() in browser but could not find current service', service);
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
    this.id = id;
    const backendUrl = `/api/${id}`;
    console.log(`Connecting ${this.name} to ${backendUrl}`)
    this.eventSource = new EventSource(backendUrl);
    const onMessage = event => this.onMessage(event);
    const onError = error => {
      if (error.status === 504) { // HTTP Gateway Timeout 
        this.eventSource.removeEventListener('data', onMessage);
        this.eventSource.removeEventListener('error', onError);
        this.eventSource = undefined;
        console.log('Reconnecting browser runtime', error, error.status);
        setTimeout(() => this.connect(id), 1000);
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

  onMessage(e) {
    const command = JSON.parse(e.data);
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
        return console.log('Received ping ...');
      default:
        console.error('Unknown action in browser runtime: ', command);
    }
  }

  sendResult(serviceUuid, data, requestId) {
    if (!this.id) {
      return console.error('Could not send result data, no backend is connected');
    }
    return request(`${this.id}/${requestId}`, 'POST', false, data);
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