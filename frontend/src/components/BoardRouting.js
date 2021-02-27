import React, { Component } from 'react';

import { s, t } from '../styles';
import InputField from './shared/InputField';

export default class BoardRouting extends Component {
  state = {
    inputUrl: '',
    inputTopic: '',
    outputUrl: '',
    outputTopic: '',
  };

  componentDidMount() {
    const { routing={} } = this.props;
    const { 
      inputUrl='', 
      inputTopic='',
      outputUrl='',
      outputTopic='',
    } = routing;
    this.setState({ inputUrl, inputTopic, outputUrl, outputTopic });
  }

  componentDidUpdate(prevProps) {
    /*
    // TODO: we don't need this function at all!!
    const { inputUrl, outputUrl } = this.props;
    if(prevProps.inputUrl !== inputUrl) {
      this.setState({ inputUrl });
    }
    if(prevProps.outputUrl !== outputUrl) {
      this.setState({ outputUrl });
    }
    */
  }

  render() {
    const {
      inputUrl,
      inputTopic,
      outputUrl,
      outputTopic,
    } = this.state;
    const { onChange } = this.props;
    const style = s(t.fs12, t.ls1, t.uc)
    return (
      <div style={s(style, { display: 'flex', flexDirection: 'column', width: '93%' })}>
        <div style={s(t.mb5, t.fs11, t.bold)}>Board Routing</div>
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <InputField
            style={t.w100}
            label="Input URL"
            value={inputUrl}
            onChange={(ev, { value: inputUrl }) => 
              this.setState(
                { inputUrl }, 
                () => onChange({ inputUrl, inputTopic, outputUrl, outputTopic })
              )
            }
          />
          <InputField
            style={t.w100}
            label="Input Topic"
            value={inputTopic}
            onChange={(ev, { value: inputTopic }) => 
              this.setState(
                { inputTopic }, 
                () => onChange({ inputUrl, inputTopic, outputUrl, outputTopic })
              )
            }
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <InputField
            label="Output URL"
            value={outputUrl}
            onChange={(ev, { value: outputUrl }) => 
              this.setState(
                { outputUrl },
                () => onChange({ inputUrl, inputTopic, outputUrl, outputTopic })
              )
            }
          />
          <InputField
            label="Output Topic"
            value={outputTopic}
            onChange={(ev, { value: outputTopic }) => 
              this.setState(
                { outputTopic },
                () => onChange({ inputUrl, inputTopic, outputUrl, outputTopic })
              )
            }
          />
        </div>
      </div>
    );
  }
}