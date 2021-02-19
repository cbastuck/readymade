import React, { Component } from 'react';

import { s, t } from '../styles';
import InputField from './shared/InputField';

export default class BoardRouting extends Component {
  state = {
    inputUrl: '',
    outputUrl: '',
  };

  componentDidMount() {
    const { routing={} } = this.props;
    const { inputUrl='', outputUrl='' } = routing;
    this.setState({ inputUrl, outputUrl });
  }

  componentDidUpdate(prevProps) {
    const { inputUrl, outputUrl } = this.props;
    if(prevProps.inputUrl !== inputUrl) {
      this.setState({ inputUrl });
    }
    if(prevProps.outputUrl !== outputUrl) {
      this.setState({ outputUrl });
    }
  }

  render() {
    const {
      inputUrl,
      outputUrl,
    } = this.state;
    const { onChange } = this.props;
    const style = s(t.fs12, t.ls1, t.uc)
    return (
      <div style={s(style, { display: 'flex', flexDirection: 'column', width: '50%' })}>
        <div style={s(t.mb5, t.fs11, t.bold)}>Board Routing</div>
        <InputField
          label="Input URL"
          value={inputUrl}
          onChange={(ev, { value: inputUrl }) => 
            this.setState(
              { inputUrl }, 
              () => onChange({ inputUrl, outputUrl })
            )
          }
        />
        <InputField
          label="Output URL"
          value={outputUrl}
          onChange={(ev, { value: outputUrl }) => 
            this.setState(
              { outputUrl },
              () => onChange({ outputUrl, inputUrl })
            )
          }
        />
      </div>
    );
  }
}