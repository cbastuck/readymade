import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';

import { s, t } from '../styles';
import InputField from './shared/InputField';

export default class BoardRouting extends Component {
  state = {
    url: ''
  };

  componentDidMount() {
    this.setState({ url: this.props.url || '' })
  }

  componentDidUpdate(prevProps) {
    const { url } = this.props;
    if(prevProps.url !== url) {
      this.setState({ url });
    }
  }

  render() {
    const { url } = this.state;
    const { onChange } = this.props;
    const style = s(t.fs12, t.ls1, t.uc)
    return (
      <div style={style}>
        <div>Board Routing</div>
        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'row'
          }}
        >
          <InputField
            label="URL"
            value={url}
            onChange={(ev, {value: url }) => this.setState({ url })}
          />
          <Button
            style={s(style, t.fs11, { width: 65 })}
            onClick={() => onChange({ url })}
            disabled={!url}
          > 
            Apply
          </Button>
        </div>
      </div>
    );
  }
}