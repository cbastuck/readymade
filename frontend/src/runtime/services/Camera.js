import React, { Component } from 'react';
import {
  Checkbox,
  Button,
} from 'semantic-ui-react';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/camera';
const serviceName = 'Camera';

class CameraUI extends Component {
  state = { mirror: true };

  componentWillUnmount() {
    this.stopVideo();
  }

  onInit(initialState) {
    this.setState({
      ...initialState
    });
  }

  initVideo = async videoElement => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    //videoElement.src = window.URL.createObjectURL(stream);
    videoElement.srcObject = stream;
    videoElement.play();
    return stream;
  }

  initVideoLegacy = video => {
    let res;
    if(navigator.getUserMedia) { // Standard
      navigator.getUserMedia(
        { video: true }, 
        stream => {
          res = stream;
          video.src = stream;
          video.play();
        },
        err => console.warn('initVideoLegacy', err)
      );
    } else if(navigator.webkitGetUserMedia) { // WebKit-prefixed
        navigator.webkitGetUserMedia(
          { video: true }, 
          stream => {
            res = stream;
            video.src = window.webkitURL.createObjectURL(stream);
            video.play();
        }, 
        err => console.warn('initVideoLegacy', err)
      );
    } else if(navigator.mozGetUserMedia) { // Mozilla-prefixed
      navigator.mozGetUserMedia(
        { video: true },
        stream => {
          res = stream;
          video.srcObject = stream;
          video.play();
        },
        err => console.warn('initVideoLegacy', err)
      );
    }
    return res;
  }

  startVideo = async videoElement => {
    let stream;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      stream = await this.initVideo(videoElement);
    } else {
      stream = this.initVideoLegacy(videoElement);
    }
    this.setState({ stream });
  }

  stopVideo = () => {
    const { stream } = this.state;
    if (stream) {
      if (stream.getTracks) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      } else if (stream.stop) {
        stream.stop(); 
      } else {
        console.warn('No way to stop the stream?');
      }
      
      this.videoElement.srcObject = null;
      this.setState({ stream: null });
    }
  }

  renderMain = () => {
    const mirrorStyle = this.state.mirror && {
      transform: 'rotateY(180deg)',
      WebkitTransform: 'rotateY(180deg)', /* Safari and Chrome */
      MozTransform: 'rotateY(180deg)',  /* Firefox */
    };
    return (
      <div style={{ textAlign: 'center' }}>
        <video 
          ref={videoElement => {
            if (!this.videoElement) {
              this.videoElement = videoElement;
              this.startVideo(videoElement);
            } else if (videoElement && this.videoElement !== videoElement) {
              console.warn('HEY setting again a video element', videoElement, this.videoElement)
            }
          }}
          style={{ 
            border: 'solid 1px lightgray',
            borderRadius: 5,
            ...mirrorStyle,
          }}
          width="320" 
          height="240" 
          autoPlay
        />
        <div 
          style={{ 
            textAlign: 'left',
            marginBottom: 5,
          }}
        >
          <Checkbox
            label="Mirror"
            checked={this.state.mirror}
            onChange={(_, { checked }) => 
              this.setState({ mirror: checked })
            }
          />
        </div>
        <div>
          <Button
            disabled={!!this.state.stream && !!this.videoElement}
            onClick={() => this.startVideo(this.videoElement) }
          >
            Start
          </Button>
          <Button
            disabled={!this.state.stream}
            onClick={() => this.stopVideo() }
          >
            Stop
          </Button>
        </div>
      </div>
    );
  }

  render() {
    return (
       <ServiceUI
        {...this.props} 
        onInit={this.onInit.bind(this)}
        segments={[
          { name: 'Main', render: this.renderMain },
        ]}
      />
    )
  }
}

class Camera {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {
  }

  async process(params) {
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Camera(app, board, descriptor, id),
  createUI: CameraUI
};

export default descriptor;